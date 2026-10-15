begin;
create table if not exists public.learning_progress (
  id uuid primary key default gen_random_uuid(),
  anonymous_uuid text not null unique,
  profile_id uuid references public.profiles(id) on delete set null,
  quiz_scores jsonb not null default '{}'::jsonb,
  badges jsonb not null default '[]'::jsonb,
  game_coins jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists learning_progress_profile_id_idx on public.learning_progress(profile_id);
alter table public.learning_progress enable row level security;
drop policy if exists "learning progress is server managed" on public.learning_progress;
revoke all on public.learning_progress from anon, authenticated;
grant all on public.learning_progress to service_role;
commit;
