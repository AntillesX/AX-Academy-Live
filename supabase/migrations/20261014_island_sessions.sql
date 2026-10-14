create table if not exists public.island_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  seed bigint not null,
  sim_version text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  started_at timestamptz not null default now(),
  closed_at timestamptz,
  score int,
  ticks int,
  antx_awarded int,
  xp_awarded int
);

create index if not exists island_sessions_user_status_idx
  on public.island_sessions (user_id, status);

alter table public.island_sessions enable row level security;

create or replace function public.award_island_run(
  p_session_id uuid,
  p_user_id uuid,
  p_antx int,
  p_xp int,
  p_score int,
  p_ticks int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count int;
begin
  if p_antx < 0 or p_xp < 0 or p_score < 0 or p_ticks < 0 then
    return false;
  end if;

  update public.island_sessions
  set status = 'closed',
      closed_at = now(),
      score = least(p_score, 1000000),
      ticks = least(p_ticks, 1000000),
      antx_awarded = least(p_antx, 5),
      xp_awarded = least(p_xp, 100)
  where id = p_session_id
    and user_id = p_user_id
    and status = 'open';

  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;

revoke all on function public.award_island_run(uuid, uuid, int, int, int, int) from public, anon, authenticated;
grant execute on function public.award_island_run(uuid, uuid, int, int, int, int) to service_role;
