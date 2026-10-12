begin;
create table if not exists public.curriculum_subjects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists public.curriculum_modules (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.curriculum_subjects(id) on delete cascade,
  title text not null,
  summary text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.curriculum_topics (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.curriculum_modules(id) on delete cascade,
  title text not null,
  kind text not null default 'lesson' check (kind in ('lesson', 'video', 'quiz', 'project')),
  resource_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.curriculum_subjects enable row level security;
alter table public.curriculum_modules enable row level security;
alter table public.curriculum_topics enable row level security;
drop policy if exists "curriculum subjects are publicly readable" on public.curriculum_subjects;
drop policy if exists "curriculum modules are publicly readable" on public.curriculum_modules;
drop policy if exists "curriculum topics are publicly readable" on public.curriculum_topics;
create policy "curriculum subjects are publicly readable" on public.curriculum_subjects for select using (true);
create policy "curriculum modules are publicly readable" on public.curriculum_modules for select using (true);
create policy "curriculum topics are publicly readable" on public.curriculum_topics for select using (true);
revoke insert, update, delete on public.curriculum_subjects, public.curriculum_modules, public.curriculum_topics from anon, authenticated;
grant select on public.curriculum_subjects, public.curriculum_modules, public.curriculum_topics to anon, authenticated;
grant all on public.curriculum_subjects, public.curriculum_modules, public.curriculum_topics to service_role;
insert into public.curriculum_subjects (code, name, description) values
 ('MATH', 'Mathematics', 'Core quantitative reasoning and problem solving.'),
 ('PHYS', 'Physics', 'Motion, energy, forces, and practical investigation.'),
 ('ENGLISH', 'English', 'Reading, writing, argument, and communication.'),
 ('IT', 'Information Technology', 'Digital systems, citizenship, and computing.'),
 ('CHEM', 'Chemistry', 'Matter, reactions, laboratory reasoning, and safety.'),
 ('BIO', 'Biology', 'Living systems, health, ecology, and evidence.' )
on conflict (code) do nothing;
commit;
