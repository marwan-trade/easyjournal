-- EasyJournal : schéma Supabase. À coller UNE FOIS dans « SQL Editor » puis « Run ».
-- Chaque ligne appartient à un utilisateur (user_id) et n'est visible que par lui (Row Level Security).

create table if not exists public.trades (
  user_id    uuid    not null default auth.uid() references auth.users(id) on delete cascade,
  id         text    not null,
  mode       text,
  date       text,
  data       jsonb   not null default '{}'::jsonb,
  updated_at bigint  not null,
  deleted    boolean not null default false,
  primary key (user_id, id)
);

create table if not exists public.ideas (
  user_id    uuid    not null default auth.uid() references auth.users(id) on delete cascade,
  id         text    not null,
  data       jsonb   not null default '{}'::jsonb,
  updated_at bigint  not null,
  deleted    boolean not null default false,
  primary key (user_id, id)
);

create table if not exists public.user_settings (
  user_id    uuid   primary key default auth.uid() references auth.users(id) on delete cascade,
  data       jsonb  not null default '{}'::jsonb,
  updated_at bigint not null
);

create index if not exists trades_updated_idx on public.trades (user_id, updated_at);
create index if not exists ideas_updated_idx  on public.ideas  (user_id, updated_at);

alter table public.trades        enable row level security;
alter table public.ideas         enable row level security;
alter table public.user_settings enable row level security;

drop policy if exists "trades: propriétaire" on public.trades;
drop policy if exists "ideas: propriétaire" on public.ideas;
drop policy if exists "settings: propriétaire" on public.user_settings;

create policy "trades: propriétaire"   on public.trades        for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ideas: propriétaire"    on public.ideas         for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "settings: propriétaire" on public.user_settings for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Aucun accès pour les visiteurs non connectés ; accès complet (limité par les règles ci-dessus) pour les connectés.
revoke all on public.trades, public.ideas, public.user_settings from anon;
grant select, insert, update, delete on public.trades, public.ideas, public.user_settings to authenticated;
