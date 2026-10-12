begin;
create table if not exists public.audio_channels (
  topic text primary key check (topic in ('study', 'meditation')),
  video_id text not null check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  channel text not null check (char_length(btrim(channel)) between 1 and 100),
  updated_at timestamptz not null default now()
);
alter table public.audio_channels enable row level security;
drop policy if exists "audio channels are publicly readable" on public.audio_channels;
create policy "audio channels are publicly readable" on public.audio_channels for select using (true);
revoke insert, update, delete on public.audio_channels from anon, authenticated;
grant select on public.audio_channels to anon, authenticated;
grant all on public.audio_channels to service_role;
insert into public.audio_channels (topic, video_id, title, channel) values
  ('study', 'jfKfPfyJRdk', 'Study Music', 'Focus channel'),
  ('meditation', '5qap5aO4i9A', 'Meditation Vibes', 'Calm channel')
on conflict (topic) do nothing;
commit;
