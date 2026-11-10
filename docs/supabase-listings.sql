-- Table behind the "suggest a change" flow (src/lib/listings.ts).
-- Applied to the nslivemusic Supabase project on 2026-11-10.
create table public.listings (
  id text primary key,
  kind text not null check (kind in ('new','edit','remove','report')),
  status text not null check (status in ('live','pending','rejected','applied','removed','done')),
  target_id text,
  event_id text,
  entry jsonb,
  note text,
  contact text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index listings_status_idx on public.listings (status);
-- Only the server (secret key) may read or write: no policies for anon/authenticated.
alter table public.listings enable row level security;
revoke all on public.listings from anon, authenticated;
