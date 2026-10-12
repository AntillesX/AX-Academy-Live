-- AX-Academy Live v2: community contact and arcade support.
-- Idempotent migration; arcade scores remain closed-loop XP only.
begin;
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  email text not null check (char_length(btrim(email)) between 3 and 160),
  message text not null check (char_length(btrim(message)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists contact_messages_created_at_idx on public.contact_messages (created_at desc);
alter table public.contact_messages enable row level security;
revoke all on public.contact_messages from public, anon, authenticated;
grant insert on public.contact_messages to service_role;
-- The existing 20261012000814 migration owns arcade_scores and its server-only RPC.
-- This acknowledgement keeps the v2 pack compatible with both migration naming schemes.
commit;
