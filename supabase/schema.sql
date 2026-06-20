-- ==========================================================================
-- WhatsApp Clone - Esquema de base de datos para Supabase
-- Ejecuta todo este archivo en el SQL Editor de Supabase.
-- ==========================================================================

-- ---------------------------------------------------------------------------
-- 0. Utilidades / extensiones
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. Tabla PROFILES (extiende auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  display_name text not null default '',
  avatar_url  text,
  about       text not null default 'Hey there! I am using WhatsApp Clone.',
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Trigger para crear perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at automático
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 2. CHATS (conversaciones directas o grupales)
-- ---------------------------------------------------------------------------
create table if not exists public.chats (
  id            uuid primary key default gen_random_uuid(),
  type          text not null check (type in ('direct','group')) default 'direct',
  name          text,
  description   text,
  avatar_url    text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. CHAT_MEMBERS (pertenencia a chats)
-- ---------------------------------------------------------------------------
create table if not exists public.chat_members (
  chat_id   uuid not null references public.chats(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role      text not null check (role in ('member','admin')) default 'member',
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);

create index if not exists idx_chat_members_user on public.chat_members(user_id);
create index if not exists idx_chats_last_msg on public.chats(last_message_at desc);

-- ---------------------------------------------------------------------------
-- 4. MESSAGES
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  chat_id     uuid not null references public.chats(id) on delete cascade,
  sender_id   uuid not null references public.profiles(id) on delete cascade,
  content     text,
  type        text not null check (type in ('text','image','file','audio','system')) default 'text',
  file_url    text,
  file_name   text,
  file_size   bigint,
  reply_to_id uuid references public.messages(id) on delete set null,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists idx_messages_chat on public.messages(chat_id, created_at desc);

-- Actualizar last_message_at del chat al insertar mensaje
create or replace function public.touch_chat_last_message()
returns trigger language plpgsql as $$
begin
  update public.chats set last_message_at = now() where id = new.chat_id;
  return new;
end;
$$;

drop trigger if exists messages_touch_chat on public.messages;
create trigger messages_touch_chat
  after insert on public.messages
  for each row execute function public.touch_chat_last_message();

-- ---------------------------------------------------------------------------
-- 5. Función helper: ¿es miembro del chat?
-- ---------------------------------------------------------------------------
create or replace function public.is_chat_member(p_chat uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.chat_members where chat_id = p_chat and user_id = p_user);
$$;

-- ---------------------------------------------------------------------------
-- 6. STATUSES (estados / stories) - expiran a las 24h
-- ---------------------------------------------------------------------------
create table if not exists public.statuses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        text not null check (type in ('text','image')) default 'text',
  content     text,
  file_url    text,
  bg_color    text not null default '#075e54',
  caption     text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_statuses_user on public.statuses(user_id, created_at desc);

create or replace function public.active_statuses(p_user uuid)
returns setof public.statuses language sql stable security definer set search_path = public as $$
  select * from public.statuses
  where user_id = p_user
    and created_at > now() - interval '24 hours'
  order by created_at asc;
$$;

-- ---------------------------------------------------------------------------
-- 7. STATUS_VIEWS (quién vio un estado)
-- ---------------------------------------------------------------------------
create table if not exists public.status_views (
  status_id uuid not null references public.statuses(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (status_id, user_id)
);

-- ---------------------------------------------------------------------------
-- 8. CALLS (registro de llamadas)
-- ---------------------------------------------------------------------------
create table if not exists public.calls (
  id          uuid primary key default gen_random_uuid(),
  chat_id     uuid references public.chats(id) on delete set null,
  room_name   text not null,
  type        text not null check (type in ('audio','video')) default 'audio',
  status      text not null check (status in ('started','answered','declined','missed','ended')) default 'started',
  started_by  uuid not null references public.profiles(id) on delete cascade,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz
);

create index if not exists idx_calls_room on public.calls(room_name);

-- ---------------------------------------------------------------------------
-- 9. STORAGE BUCKETS
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', true),
  ('chat-files', 'chat-files', true),
  ('statuses', 'statuses', true)
on conflict (id) do nothing;

-- ==========================================================================
-- 10. ROW LEVEL SECURITY
-- ==========================================================================
alter table public.profiles       enable row level security;
alter table public.chats          enable row level security;
alter table public.chat_members   enable row level security;
alter table public.messages       enable row level security;
alter table public.statuses       enable row level security;
alter table public.status_views   enable row level security;
alter table public.calls          enable row level security;

-- ---- PROFILES ----
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (true);

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (auth.uid() = id);

-- ---- CHATS ----
drop policy if exists chats_select on public.chats;
create policy chats_select on public.chats
  for select using (public.is_chat_member(id, auth.uid()));

drop policy if exists chats_insert on public.chats;
create policy chats_insert on public.chats
  for insert with check (auth.uid() = created_by);

drop policy if exists chats_update on public.chats;
create policy chats_update on public.chats
  for update using (public.is_chat_member(id, auth.uid()));

-- ---- CHAT_MEMBERS ----
drop policy if exists members_select on public.chat_members;
create policy members_select on public.chat_members
  for select using (
    public.is_chat_member(chat_id, auth.uid()) or user_id = auth.uid()
  );

drop policy if exists members_insert on public.chat_members;
create policy members_insert on public.chat_members
  for insert with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.chats c
      join public.chat_members m on m.chat_id = c.id
      where c.id = chat_id and m.user_id = auth.uid() and m.role = 'admin'
    )
  );

drop policy if exists members_delete on public.chat_members;
create policy members_delete on public.chat_members
  for delete using (user_id = auth.uid());

drop policy if exists members_update on public.chat_members;
create policy members_update on public.chat_members
  for update using (user_id = auth.uid());

-- ---- MESSAGES ----
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select using (public.is_chat_member(chat_id, auth.uid()));

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert with check (sender_id = auth.uid() and public.is_chat_member(chat_id, auth.uid()));

drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages
  for update using (sender_id = auth.uid());

-- ---- STATUSES ----
drop policy if exists statuses_select on public.statuses;
create policy statuses_select on public.statuses
  for select using (true);

drop policy if exists statuses_insert on public.statuses;
create policy statuses_insert on public.statuses
  for insert with check (user_id = auth.uid());

drop policy if exists statuses_delete on public.statuses;
create policy statuses_delete on public.statuses
  for delete using (user_id = auth.uid());

-- ---- STATUS_VIEWS ----
drop policy if exists views_select on public.status_views;
create policy views_select on public.status_views
  for select using (true);

drop policy if exists views_insert on public.status_views;
create policy views_insert on public.status_views
  for insert with check (user_id = auth.uid());

-- ---- CALLS ----
drop policy if exists calls_select on public.calls;
create policy calls_select on public.calls
  for select using (
    public.is_chat_member(chat_id, auth.uid()) or started_by = auth.uid()
  );

drop policy if exists calls_insert on public.calls;
create policy calls_insert on public.calls
  for insert with check (started_by = auth.uid());

drop policy if exists calls_update on public.calls;
create policy calls_update on public.calls
  for update using (started_by = auth.uid());

-- ==========================================================================
-- 11. STORAGE POLICIES
-- ==========================================================================
-- Avatares: cualquiera autenticado puede subir/leer
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars_auth_insert" on storage.objects;
create policy "avatars_auth_insert" on storage.objects
  for insert with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update" on storage.objects
  for update using (bucket_id = 'avatars' and auth.role() = 'authenticated');

-- Chat files: lectura pública, subida autenticada
drop policy if exists "chatfiles_public_read" on storage.objects;
create policy "chatfiles_public_read" on storage.objects
  for select using (bucket_id = 'chat-files');

drop policy if exists "chatfiles_auth_insert" on storage.objects;
create policy "chatfiles_auth_insert" on storage.objects
  for insert with check (bucket_id = 'chat-files' and auth.role() = 'authenticated');

-- Statuses media
drop policy if exists "statuses_public_read" on storage.objects;
create policy "statuses_public_read" on storage.objects
  for select using (bucket_id = 'statuses');

drop policy if exists "statuses_auth_insert" on storage.objects;
create policy "statuses_auth_insert" on storage.objects
  for insert with check (bucket_id = 'statuses' and auth.role() = 'authenticated');

-- ==========================================================================
-- 12. REALTIME (publicar tablas en el supabase_realtime publication)
-- ==========================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chats'
  ) then
    alter publication supabase_realtime add table public.chats;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_members'
  ) then
    alter publication supabase_realtime add table public.chat_members;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'statuses'
  ) then
    alter publication supabase_realtime add table public.statuses;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'status_views'
  ) then
    alter publication supabase_realtime add table public.status_views;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'calls'
  ) then
    alter publication supabase_realtime add table public.calls;
  end if;
end $$;

-- Limpieza periódica de estados expirados (ejecutar manualmente o con pg_cron)
-- Si tienes pg_cron habilitado:
-- select cron.schedule('clean-statuses', '0 * * * *', 'delete from public.statuses where created_at < now() - interval ''24 hours'';');

-- Fin del esquema.
