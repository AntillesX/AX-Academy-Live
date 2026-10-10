create extension if not exists pgcrypto;

create type public.profile_role as enum ('student', 'admin');
create type public.media_asset_type as enum ('intro_video', 'avatar_gear', 'store_texture');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  email text not null unique,
  role public.profile_role not null default 'student',
  x_balance bigint not null default 0 check (x_balance >= 0),
  antx_balance bigint not null default 0 check (antx_balance >= 0),
  created_at timestamptz not null default now()
);

create table public.passkeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  credential_id text not null unique,
  public_key bytea not null,
  counter bigint not null default 0,
  transports text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_url text not null,
  asset_type public.media_asset_type not null,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.passkey_challenges (
  id uuid primary key default gen_random_uuid(),
  challenge text not null,
  email text not null,
  purpose text not null check (purpose in ('registration', 'authentication')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, lower(new.email), case when lower(new.email) = 'antillesacademy@protonmail.com' then 'admin'::public.profile_role else 'student'::public.profile_role end)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.enforce_admin_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if lower(new.email) = 'antillesacademy@protonmail.com' then new.role := 'admin'; end if;
  return new;
end;
$$;
create trigger profiles_admin_override before insert or update on public.profiles
for each row execute procedure public.enforce_admin_role();

alter table public.profiles enable row level security;
alter table public.passkeys enable row level security;
alter table public.media_assets enable row level security;
alter table public.passkey_challenges enable row level security;

create policy "profiles are readable by owner" on public.profiles for select using (auth.uid() = id);
create policy "users can update their own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "passkeys are managed by owner" on public.passkeys for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "media assets are public to read" on public.media_assets for select using (true);
create policy "admins manage media assets" on public.media_assets for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
-- Challenge rows are accessed only through the server-side service-role client.

insert into storage.buckets (id, name, public) values ('platform-media', 'platform-media', true) on conflict (id) do update set public = true;
create policy "public can read platform media" on storage.objects for select using (bucket_id = 'platform-media');
create policy "admins can upload platform media" on storage.objects for insert with check (bucket_id = 'platform-media' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "admins can replace platform media" on storage.objects for update using (bucket_id = 'platform-media' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
