-- Run this in your Supabase project's SQL editor
-- (Dashboard → SQL Editor → New query → paste → Run).
-- Safe to re-run: every statement is idempotent.

-- ---------------------------------------------------------------------------
-- profiles: one row per authenticated user.
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  username         text unique,
  -- theme_id is null on a brand-new account so the client can decide
  -- whether to seed it from the user's existing local preference.
  theme_id         text,
  unlocks          text[] not null default array[]::text[],
  points           int  not null default 0,
  lifetime_points  int  not null default 0,
  updated_at       timestamptz not null default now()
);

-- Additive migrations for projects that ran an earlier version of this file.
alter table public.profiles add column if not exists username        text unique;
alter table public.profiles add column if not exists points          int  not null default 0;
alter table public.profiles add column if not exists lifetime_points int  not null default 0;

alter table public.profiles enable row level security;

-- Each user can only read/write their own row.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = user_id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Auto-create a profile row whenever a new user signs up.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Leaderboard reads: returns only public-safe columns, bypasses RLS so any
-- visitor can see the standings. Username is required to appear.
-- ---------------------------------------------------------------------------

create or replace function public.get_leaderboard_total(lim int default 100)
returns table (rank int, username text, lifetime_points int)
language sql
security definer
set search_path = public
as $$
  select
    cast(row_number() over (order by p.lifetime_points desc, p.username asc) as int) as rank,
    p.username,
    p.lifetime_points
  from public.profiles p
  where p.username is not null
  order by p.lifetime_points desc, p.username asc
  limit lim;
$$;

grant execute on function public.get_leaderboard_total(int) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Points mutations: keep the math server-side so the client can't fabricate
-- balances. Callable only by the signed-in user (acts on their own row).
-- ---------------------------------------------------------------------------

create or replace function public.add_points(amount int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if amount is null or amount <= 0 then
    raise exception 'amount must be positive';
  end if;
  update public.profiles
     set points          = points + amount,
         lifetime_points = lifetime_points + amount,
         updated_at      = now()
   where user_id = auth.uid();
end;
$$;

grant execute on function public.add_points(int) to authenticated;

create or replace function public.spend_points(amount int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  rows_affected int := 0;
begin
  if amount is null or amount <= 0 then
    raise exception 'amount must be positive';
  end if;
  update public.profiles
     set points     = points - amount,
         updated_at = now()
   where user_id = auth.uid()
     and points  >= amount;
  get diagnostics rows_affected = row_count;
  return rows_affected > 0;
end;
$$;

grant execute on function public.spend_points(int) to authenticated;
