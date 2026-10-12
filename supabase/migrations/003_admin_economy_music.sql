-- AX-Academy Live v3: admin audit, economy guardrails, and music metadata.
begin;
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid,
  action text not null check (char_length(btrim(action)) between 1 and 120),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.music_streams (
  id uuid primary key default gen_random_uuid(),
  youtube_video_id text not null check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  title text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_created_at_idx on public.admin_audit_log (created_at desc);
create index if not exists music_streams_enabled_idx on public.music_streams (enabled, created_at desc);
alter table public.admin_audit_log enable row level security;
alter table public.music_streams enable row level security;
revoke all on public.admin_audit_log, public.music_streams from public, anon, authenticated;
grant all on public.admin_audit_log, public.music_streams to service_role;
insert into public.music_streams (youtube_video_id, title) values ('jfKfPfyJRdk', 'lofi hip hop radio') on conflict do nothing;
commit;
