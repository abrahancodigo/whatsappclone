-- Migration: Add contacts table
-- Run this in Supabase SQL Editor if you already have the initial schema

create table if not exists public.contacts (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  contact_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, contact_id),
  check (user_id <> contact_id)
);

create index if not exists idx_contacts_user on public.contacts(user_id);
create index if not exists idx_contacts_contact on public.contacts(contact_id);

alter table public.contacts enable row level security;

drop policy if exists contacts_select on public.contacts;
create policy contacts_select on public.contacts
  for select using (user_id = auth.uid());

drop policy if exists contacts_insert on public.contacts;
create policy contacts_insert on public.contacts
  for insert with check (user_id = auth.uid());

drop policy if exists contacts_delete on public.contacts;
create policy contacts_delete on public.contacts
  for delete using (user_id = auth.uid());

-- Add to realtime
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'contacts'
  ) then
    alter publication supabase_realtime add table public.contacts;
  end if;
end $$;
