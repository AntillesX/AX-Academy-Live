-- AX-Academy Live v5.2: managed platform video library.
begin;
create extension if not exists pgcrypto;
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 180),
  category text not null check (char_length(btrim(category)) between 1 and 80),
  youtube_url text not null check (youtube_url ~* '^https?://(www\.)?(youtube\.com|youtu\.be)/'),
  created_at timestamptz not null default now()
);
create index if not exists videos_category_created_at_idx on public.videos (category, created_at desc);
alter table public.videos enable row level security;
drop policy if exists "videos are publicly readable" on public.videos;
create policy "videos are publicly readable" on public.videos for select using (true);
revoke insert, update, delete on public.videos from anon, authenticated;
grant select on public.videos to anon, authenticated;
grant all on public.videos to service_role;
commit;
