begin;
create table if not exists public.beach_buffet_sessions (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete set null,
  score integer not null default 0 check (score >= 0),
  combo integer not null default 0 check (combo >= 0),
  selected_food text,
  served_count integer not null default 0 check (served_count >= 0),
  status text not null default 'idle' check (status in ('idle','playing','complete')),
  updated_at timestamptz not null default now()
);
alter table public.beach_buffet_sessions enable row level security;
drop policy if exists "beach buffet sessions are private" on public.beach_buffet_sessions;
create policy "beach buffet sessions are private" on public.beach_buffet_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.beach_buffet_sessions to authenticated;
revoke all on public.beach_buffet_sessions from anon;
-- Supabase Realtime will stream updates once the migration is applied to the project.
alter publication supabase_realtime add table public.beach_buffet_sessions;
commit;
