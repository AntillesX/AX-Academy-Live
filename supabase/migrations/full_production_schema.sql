-- AntillesX full production schema bundle
-- Apply this file once to a fresh production Supabase project.
-- The service-role key bypasses RLS and must remain server-side only.

create extension if not exists pgcrypto;

do $$ begin create type public.profile_role as enum ('student', 'admin'); exception when duplicate_object then null; end $$;
do $$ begin create type public.media_asset_type as enum ('intro_video', 'avatar_gear', 'store_texture'); exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  email text not null unique,
  role public.profile_role not null default 'student',
  x_balance bigint not null default 0 check (x_balance >= 0),
  antx_balance bigint not null default 0 check (antx_balance >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.passkeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  credential_id text not null unique,
  public_key bytea not null,
  counter bigint not null default 0,
  transports text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_url text not null,
  asset_type public.media_asset_type not null,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.passkey_challenges (
  id uuid primary key default gen_random_uuid(),
  challenge text not null,
  email text not null,
  purpose text not null check (purpose in ('registration', 'authentication')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.real_estate (
  id uuid primary key default gen_random_uuid(),
  island text not null,
  capital text not null,
  property_type text not null check (property_type in ('airport', 'library', 'internet_cafe', 'island_academy', 'avatar_store')),
  name text not null,
  lessee_id uuid references public.profiles(id) on delete set null,
  lease_started_at timestamptz,
  lease_ends_at timestamptz,
  xp_yield_rate numeric(8,4) not null default 0.0100 check (xp_yield_rate >= 0),
  created_at timestamptz not null default now(),
  check (lease_ends_at is null or lease_started_at is null or lease_ends_at > lease_started_at)
);

create table if not exists public.lotteries (
  id uuid primary key default gen_random_uuid(),
  lottery_type text not null check (lottery_type in ('island', 'mega_antilles')),
  island text,
  draw_at timestamptz not null,
  jackpot_xp bigint not null default 0 check (jackpot_xp >= 0),
  ticket_price_xp bigint not null default 100 check (ticket_price_xp > 0),
  status text not null default 'open' check (status in ('open', 'drawn', 'cancelled')),
  created_at timestamptz not null default now(),
  check ((lottery_type = 'island' and island is not null) or lottery_type = 'mega_antilles')
);

create table if not exists public.lottery_tickets (
  id uuid primary key default gen_random_uuid(),
  lottery_id uuid not null references public.lotteries(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  purchased_at timestamptz not null default now()
);

create table if not exists public.auctions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  asset_type text not null check (asset_type in ('cosmetic', 'real_estate_lease', 'shop_layout')),
  creator_id uuid not null references public.profiles(id),
  current_bid_xp bigint not null default 0 check (current_bid_xp >= 0),
  current_bid_antx bigint not null default 0 check (current_bid_antx >= 0),
  highest_bidder_id uuid references public.profiles(id) on delete set null,
  ends_at timestamptz not null,
  status text not null default 'live' check (status in ('draft', 'live', 'settled', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.auction_bids (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete cascade,
  bidder_id uuid not null references public.profiles(id) on delete cascade,
  amount_xp bigint not null default 0 check (amount_xp >= 0),
  amount_antx bigint not null default 0 check (amount_antx >= 0),
  escrow_status text not null default 'reserved' check (escrow_status in ('reserved', 'released', 'captured', 'refunded')),
  created_at timestamptz not null default now(),
  check (amount_xp > 0 or amount_antx > 0)
);

create or replace function public.is_admin(subject_id uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = subject_id and role = 'admin');
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, lower(new.email), case when lower(new.email) = 'antillesacademy@protonmail.com' then 'admin'::public.profile_role else 'student'::public.profile_role end)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.enforce_admin_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if lower(new.email) = 'antillesacademy@protonmail.com' then new.role := 'admin'; end if;
  return new;
end;
$$;
drop trigger if exists profiles_admin_override on public.profiles;
create trigger profiles_admin_override before insert or update on public.profiles for each row execute procedure public.enforce_admin_role();

alter table public.profiles enable row level security;
alter table public.passkeys enable row level security;
alter table public.media_assets enable row level security;
alter table public.passkey_challenges enable row level security;
alter table public.real_estate enable row level security;
alter table public.lotteries enable row level security;
alter table public.lottery_tickets enable row level security;
alter table public.auctions enable row level security;
alter table public.auction_bids enable row level security;

-- Re-runnable policy definitions.
drop policy if exists "profiles are readable by owner" on public.profiles;
create policy "profiles are readable by owner" on public.profiles for select using (auth.uid() = id or public.is_admin());
drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "passkeys are managed by owner" on public.passkeys;
create policy "passkeys are managed by owner" on public.passkeys for all using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "media assets are public to read" on public.media_assets;
create policy "media assets are public to read" on public.media_assets for select using (true);
drop policy if exists "admins manage media assets" on public.media_assets;
create policy "admins manage media assets" on public.media_assets for all using (public.is_admin()) with check (public.is_admin());

-- Challenge rows are server-only; no client policy is granted.
drop policy if exists "public can read real estate" on public.real_estate;
create policy "public can read real estate" on public.real_estate for select using (true);
drop policy if exists "admins manage real estate" on public.real_estate;
create policy "admins manage real estate" on public.real_estate for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "lotteries are readable" on public.lotteries;
create policy "lotteries are readable" on public.lotteries for select using (true);
drop policy if exists "admins manage lotteries" on public.lotteries;
create policy "admins manage lotteries" on public.lotteries for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "users manage their tickets" on public.lottery_tickets;
create policy "users manage their tickets" on public.lottery_tickets for select using (auth.uid() = user_id or public.is_admin());
create policy "users buy their tickets" on public.lottery_tickets for insert with check (auth.uid() = user_id);

drop policy if exists "auctions are publicly readable" on public.auctions;
create policy "auctions are publicly readable" on public.auctions for select using (true);
drop policy if exists "creators manage their auctions" on public.auctions;
create policy "creators manage their auctions" on public.auctions for insert with check (auth.uid() = creator_id);
drop policy if exists "admins manage auctions" on public.auctions;
create policy "admins manage auctions" on public.auctions for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "bidders read their bids" on public.auction_bids;
create policy "bidders read their bids" on public.auction_bids for select using (auth.uid() = bidder_id or public.is_admin());
drop policy if exists "bidders place their bids" on public.auction_bids;
create policy "bidders place their bids" on public.auction_bids for insert with check (auth.uid() = bidder_id);

insert into storage.buckets (id, name, public) values ('platform-media', 'platform-media', true) on conflict (id) do update set public = true;
drop policy if exists "public can read platform media" on storage.objects;
create policy "public can read platform media" on storage.objects for select using (bucket_id = 'platform-media');
drop policy if exists "admins can upload platform media" on storage.objects;
create policy "admins can upload platform media" on storage.objects for insert with check (bucket_id = 'platform-media' and public.is_admin());
drop policy if exists "admins can replace platform media" on storage.objects;
create policy "admins can replace platform media" on storage.objects for update using (bucket_id = 'platform-media' and public.is_admin());
