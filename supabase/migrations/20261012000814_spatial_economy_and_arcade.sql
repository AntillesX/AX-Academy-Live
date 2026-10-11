-- AntillesX spatial economy, artwork, tutoring, and arcade support.
-- This migration is idempotent and safe to re-run against the AX-Academy-Live Supabase project.
-- All state-changing Roblox calls must use the server-only service-role API key.

begin;

create extension if not exists pgcrypto;

create table if not exists public.user_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp_balance bigint not null default 0 check (xp_balance >= 0),
  antx_balance numeric(20, 6) not null default 0 check (antx_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_wallets
  add column if not exists xp_balance bigint not null default 0,
  add column if not exists antx_balance numeric(20, 6) not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.player_artworks (
  art_id uuid primary key default gen_random_uuid(),
  artist_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  image_data_url text not null check (char_length(image_data_url) > 0),
  royalty_percent numeric(5, 2) not null default 0 check (royalty_percent between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.player_artworks
  add column if not exists artist_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists title text,
  add column if not exists image_data_url text,
  add column if not exists royalty_percent numeric(5, 2) not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.tutor_leases (
  lease_id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references auth.users(id) on delete cascade,
  island_name text not null check (char_length(btrim(island_name)) between 1 and 80),
  room_number integer not null check (room_number > 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.tutor_leases
  add column if not exists tutor_id uuid references auth.users(id) on delete cascade,
  add column if not exists island_name text,
  add column if not exists room_number integer,
  add column if not exists expires_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

create table if not exists public.arcade_scores (
  score_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_name text not null check (char_length(btrim(game_name)) between 1 and 80),
  score bigint not null check (score >= 0),
  xp_earned bigint not null default 0 check (xp_earned >= 0),
  created_at timestamptz not null default now()
);

alter table public.arcade_scores
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists game_name text,
  add column if not exists score bigint,
  add column if not exists xp_earned bigint not null default 0,
  add column if not exists created_at timestamptz not null default now();

create index if not exists player_artworks_artist_user_id_idx
  on public.player_artworks (artist_user_id, created_at desc);
create index if not exists tutor_leases_tutor_id_expires_at_idx
  on public.tutor_leases (tutor_id, expires_at desc);
create index if not exists tutor_leases_room_expires_at_idx
  on public.tutor_leases (island_name, room_number, expires_at desc);
create index if not exists arcade_scores_user_game_score_idx
  on public.arcade_scores (user_id, game_name, score desc);

create or replace function public.set_user_wallet_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_wallets_set_updated_at on public.user_wallets;
create trigger user_wallets_set_updated_at
before update on public.user_wallets
for each row execute procedure public.set_user_wallet_updated_at();

create or replace function public.set_player_artworks_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists player_artworks_set_updated_at on public.player_artworks;
create trigger player_artworks_set_updated_at
before update on public.player_artworks
for each row execute procedure public.set_player_artworks_updated_at();

-- Backfill wallets and keep the balance ledger available for every new Supabase Auth user.
insert into public.user_wallets (user_id)
select id from auth.users
on conflict (user_id) do nothing;

create or replace function public.create_user_wallet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_wallet_created on auth.users;
create trigger on_auth_user_wallet_created
after insert on auth.users
for each row execute procedure public.create_user_wallet();

-- Atomically reserves a spatial room and deducts AntX. The advisory lock prevents two
-- concurrent leases from claiming the same active island/room pair.
create or replace function public.lease_tutor_room(
  p_user_id uuid,
  p_tutor_id uuid,
  p_island_name text,
  p_room_number integer,
  p_expires_at timestamptz,
  p_antx_cost numeric(20, 6)
)
returns public.tutor_leases
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.user_wallets%rowtype;
  v_lease public.tutor_leases%rowtype;
  v_island_name text := btrim(p_island_name);
begin
  if auth.role() <> 'service_role' then
    raise exception 'lease_tutor_room is restricted to server-side service-role calls';
  end if;

  if p_user_id is null or p_tutor_id is null then
    raise exception 'A verified user and tutor id are required';
  end if;
  if p_user_id <> p_tutor_id then
    raise exception 'Tutors may lease rooms only for their own verified identity';
  end if;
  if char_length(v_island_name) not between 1 and 80 then
    raise exception 'Island name must contain between 1 and 80 characters';
  end if;
  if p_room_number is null or p_room_number < 1 then
    raise exception 'Room number must be a positive integer';
  end if;
  if p_antx_cost is null or p_antx_cost <= 0 then
    raise exception 'AntX lease cost must be positive';
  end if;
  if p_expires_at is null or p_expires_at <= now() + interval '5 minutes' then
    raise exception 'Lease expiry must be at least five minutes in the future';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('tutor-room:' || v_island_name || ':' || p_room_number::text, 0));

  if exists (
    select 1
    from public.tutor_leases
    where island_name = v_island_name
      and room_number = p_room_number
      and expires_at > now()
  ) then
    raise exception 'Room % on % is currently leased', p_room_number, v_island_name;
  end if;

  select * into v_wallet
  from public.user_wallets
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'Wallet not found for verified user';
  end if;
  if v_wallet.antx_balance < p_antx_cost then
    raise exception 'Insufficient AntX balance';
  end if;

  update public.user_wallets
  set antx_balance = antx_balance - p_antx_cost
  where user_id = p_user_id;

  insert into public.tutor_leases (tutor_id, island_name, room_number, expires_at)
  values (p_tutor_id, v_island_name, p_room_number, p_expires_at)
  returning * into v_lease;

  return v_lease;
end;
$$;

revoke all on function public.lease_tutor_room(uuid, uuid, text, integer, timestamptz, numeric) from public;
grant execute on function public.lease_tutor_room(uuid, uuid, text, integer, timestamptz, numeric) to service_role;

-- Records a server-validated arcade result and awards XP in one transaction.
create or replace function public.record_arcade_score(
  p_user_id uuid,
  p_game_name text,
  p_score bigint,
  p_xp_earned bigint
)
returns public.user_wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.user_wallets%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'record_arcade_score is restricted to server-side service-role calls';
  end if;
  if p_user_id is null or char_length(btrim(p_game_name)) not between 1 and 80 then
    raise exception 'A verified user and valid game name are required';
  end if;
  if p_score is null or p_score < 0 or p_xp_earned is null or p_xp_earned < 0 then
    raise exception 'Score and XP earned must be non-negative';
  end if;

  select * into v_wallet
  from public.user_wallets
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'Wallet not found for verified user';
  end if;

  insert into public.arcade_scores (user_id, game_name, score, xp_earned)
  values (p_user_id, btrim(p_game_name), p_score, p_xp_earned);

  update public.user_wallets
  set xp_balance = xp_balance + p_xp_earned
  where user_id = p_user_id
  returning * into v_wallet;

  return v_wallet;
end;
$$;

revoke all on function public.record_arcade_score(uuid, text, bigint, bigint) from public;
grant execute on function public.record_arcade_score(uuid, text, bigint, bigint) to service_role;

alter table public.user_wallets enable row level security;
alter table public.player_artworks enable row level security;
alter table public.tutor_leases enable row level security;
alter table public.arcade_scores enable row level security;

drop policy if exists "wallet owner reads balance" on public.user_wallets;
create policy "wallet owner reads balance"
on public.user_wallets for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "artworks are publicly readable" on public.player_artworks;
create policy "artworks are publicly readable"
on public.player_artworks for select
using (true);
drop policy if exists "artists create their own artwork" on public.player_artworks;
create policy "artists create their own artwork"
on public.player_artworks for insert
to authenticated
with check (auth.uid() = artist_user_id);
drop policy if exists "artists update their own artwork" on public.player_artworks;
create policy "artists update their own artwork"
on public.player_artworks for update
to authenticated
using (auth.uid() = artist_user_id)
with check (auth.uid() = artist_user_id);
drop policy if exists "artists delete their own artwork" on public.player_artworks;
create policy "artists delete their own artwork"
on public.player_artworks for delete
to authenticated
using (auth.uid() = artist_user_id);

drop policy if exists "active tutor leases are readable" on public.tutor_leases;
create policy "active tutor leases are readable"
on public.tutor_leases for select
using (expires_at > now());

drop policy if exists "players read their own arcade scores" on public.arcade_scores;
create policy "players read their own arcade scores"
on public.arcade_scores for select
to authenticated
using (auth.uid() = user_id);

commit;
