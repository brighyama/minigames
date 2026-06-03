-- Run this in your Supabase project's SQL editor
-- (Dashboard → SQL Editor → New query → paste → Run).
-- Safe to re-run: every statement is idempotent.

-- ---------------------------------------------------------------------------
-- profiles: one row per authenticated user.
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  username            text unique,
  -- theme_id is null on a brand-new account so the client can decide
  -- whether to seed it from the user's existing local preference.
  theme_id            text,
  unlocks             text[] not null default array[]::text[],
  points              int  not null default 0,
  lifetime_points     int  not null default 0,
  last_daily_claim    timestamptz,
  best_reaction_avg   int,                       -- lowest avg ms over 5; null = no record
  aim_high_score      int  not null default 0,   -- most circles in a 20s round
  pattern_best_level  int  not null default 0,   -- highest completed Memory Matrix level
  color_match_best_score int not null default 0, -- best 5-round Color Match score
  casino_net          bigint not null default 0, -- cumulative casino net (can be negative)
  casino_biggest_win  int  not null default 0,   -- best single-round net win
  updated_at          timestamptz not null default now()
);

-- Additive migrations for projects that ran an earlier version of this file.
alter table public.profiles add column if not exists username           text unique;
alter table public.profiles add column if not exists points             int  not null default 0;
alter table public.profiles add column if not exists lifetime_points    int  not null default 0;
alter table public.profiles add column if not exists last_daily_claim   timestamptz;
alter table public.profiles add column if not exists best_reaction_avg  int;
alter table public.profiles add column if not exists aim_high_score     int  not null default 0;
alter table public.profiles add column if not exists pattern_best_level int  not null default 0;
alter table public.profiles add column if not exists color_match_best_score int not null default 0;
-- Casino stats: cumulative net (can be negative) + best single-round win.
alter table public.profiles add column if not exists casino_net         bigint not null default 0;
alter table public.profiles add column if not exists casino_biggest_win int    not null default 0;
alter table public.profiles add column if not exists ride_bus_open_stake bigint not null default 0;

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

-- ---------------------------------------------------------------------------
-- Daily bonus: 100 points, callable once every 24 hours. Server-enforced
-- cooldown — clients cannot fabricate an early claim.
-- Returns one row: (claimed, next_at, awarded).
--   claimed = true  -> points were just awarded
--   claimed = false -> still on cooldown; next_at = when it unlocks
-- ---------------------------------------------------------------------------

create or replace function public.claim_daily_points()
returns table (claimed boolean, next_at timestamptz, awarded int)
language plpgsql
security definer
set search_path = public
as $$
declare
  last_claim timestamptz;
  cooldown   interval := interval '24 hours';
  award      int := 100;
begin
  select last_daily_claim into last_claim
    from public.profiles
   where user_id = auth.uid();

  if last_claim is not null and (now() - last_claim) < cooldown then
    return query select false, last_claim + cooldown, 0;
    return;
  end if;

  update public.profiles
     set points           = points + award,
         lifetime_points  = lifetime_points + award,
         last_daily_claim = now(),
         updated_at       = now()
   where user_id = auth.uid();

  return query select true, now() + cooldown, award;
end;
$$;

grant execute on function public.claim_daily_points() to authenticated;

-- ---------------------------------------------------------------------------
-- Per-game high scores: write only if better than the current record.
-- Returns the new effective best (unchanged if not improved).
-- ---------------------------------------------------------------------------

create or replace function public.update_reaction_best(avg_ms int)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  current_best int;
begin
  if avg_ms is null or avg_ms <= 0 then
    raise exception 'avg_ms must be positive';
  end if;
  select best_reaction_avg into current_best
    from public.profiles where user_id = auth.uid();

  if current_best is null or avg_ms < current_best then
    update public.profiles
       set best_reaction_avg = avg_ms, updated_at = now()
     where user_id = auth.uid();
    return avg_ms;
  end if;
  return current_best;
end;
$$;
grant execute on function public.update_reaction_best(int) to authenticated;

create or replace function public.update_aim_high_score(score int)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  current_best int;
begin
  if score is null or score < 0 then
    raise exception 'score must be non-negative';
  end if;
  select aim_high_score into current_best
    from public.profiles where user_id = auth.uid();

  if score > current_best then
    update public.profiles
       set aim_high_score = score, updated_at = now()
     where user_id = auth.uid();
    return score;
  end if;
  return current_best;
end;
$$;
grant execute on function public.update_aim_high_score(int) to authenticated;

create or replace function public.submit_pattern_result(completed_level int)
returns table (best int, reward int)
language plpgsql security definer set search_path = public
as $$
declare
  current_best int;
  bounded_level int;
begin
  if completed_level is null or completed_level < 0 or completed_level > 80 then
    raise exception 'completed_level out of plausible range';
  end if;

  bounded_level := completed_level;
  reward := case
    when bounded_level = 0 then 0
    else least(60, 5 + (bounded_level * 2))
  end;

  select pattern_best_level into current_best
    from public.profiles where user_id = auth.uid();

  best := greatest(current_best, bounded_level);

  update public.profiles
     set pattern_best_level = best,
         points             = points + reward,
         lifetime_points    = lifetime_points + reward,
         updated_at         = now()
   where user_id = auth.uid();

  return next;
end;
$$;
grant execute on function public.submit_pattern_result(int) to authenticated;

create or replace function public.submit_color_match_result(score int)
returns table (best int, reward int)
language plpgsql security definer set search_path = public
as $$
declare
  current_best int;
begin
  if score is null or score < 0 or score > 5000 then
    raise exception 'score out of plausible range';
  end if;

  reward := case
    when score = 0 then 0
    else least(75, 10 + (score / 100))
  end;

  select color_match_best_score into current_best
    from public.profiles where user_id = auth.uid();

  best := greatest(current_best, score);

  update public.profiles
     set color_match_best_score = best,
         points                 = points + reward,
         lifetime_points        = lifetime_points + reward,
         updated_at             = now()
   where user_id = auth.uid();

  return next;
end;
$$;
grant execute on function public.submit_color_match_result(int) to authenticated;

-- ---------------------------------------------------------------------------
-- Per-game leaderboards: same shape as get_leaderboard_total, public-read.
-- ---------------------------------------------------------------------------

create or replace function public.get_leaderboard_reaction(lim int default 100)
returns table (rank int, username text, score int)
language sql security definer set search_path = public
as $$
  select
    cast(row_number() over (order by p.best_reaction_avg asc) as int) as rank,
    p.username,
    p.best_reaction_avg as score
  from public.profiles p
  where p.username is not null and p.best_reaction_avg is not null
  order by p.best_reaction_avg asc
  limit lim;
$$;
grant execute on function public.get_leaderboard_reaction(int) to anon, authenticated;

create or replace function public.get_leaderboard_aim(lim int default 100)
returns table (rank int, username text, score int)
language sql security definer set search_path = public
as $$
  select
    cast(row_number() over (order by p.aim_high_score desc) as int) as rank,
    p.username,
    p.aim_high_score as score
  from public.profiles p
  where p.username is not null and p.aim_high_score > 0
  order by p.aim_high_score desc
  limit lim;
$$;
grant execute on function public.get_leaderboard_aim(int) to anon, authenticated;

create or replace function public.get_leaderboard_pattern(lim int default 100)
returns table (rank int, username text, score int)
language sql security definer set search_path = public
as $$
  select
    cast(row_number() over (order by p.pattern_best_level desc, p.username asc) as int) as rank,
    p.username,
    p.pattern_best_level as score
  from public.profiles p
  where p.username is not null and p.pattern_best_level > 0
  order by p.pattern_best_level desc, p.username asc
  limit lim;
$$;
grant execute on function public.get_leaderboard_pattern(int) to anon, authenticated;

create or replace function public.get_leaderboard_color_match(lim int default 100)
returns table (rank int, username text, score int)
language sql security definer set search_path = public
as $$
  select
    cast(row_number() over (order by p.color_match_best_score desc, p.username asc) as int) as rank,
    p.username,
    p.color_match_best_score as score
  from public.profiles p
  where p.username is not null and p.color_match_best_score > 0
  order by p.color_match_best_score desc, p.username asc
  limit lim;
$$;
grant execute on function public.get_leaderboard_color_match(int) to anon, authenticated;

-- ===========================================================================
-- Casino (blackjack + roulette)
-- ===========================================================================

-- Gross return multiplier for a single roulette bet on a given winning number.
-- Returns stake×(payout+1) factor: 0 = lost; 2 = even money (1:1); 3 = 2:1;
-- 36 = straight up (35:1). Mirrors betDef() in src/games/roulette/lib.ts.
create or replace function public.roulette_multiplier(bet_id text, winning int)
returns int
language plpgsql immutable
set search_path = public
as $$
declare
  reds int[] := array[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
  n int;
begin
  if bet_id like 's-%' then
    n := substring(bet_id from 3)::int;
    return case when n = winning then 36 else 0 end;
  elsif bet_id = 'red' then
    return case when winning = any(reds) then 2 else 0 end;
  elsif bet_id = 'black' then
    return case when winning <> 0 and not (winning = any(reds)) then 2 else 0 end;
  elsif bet_id = 'even' then
    return case when winning <> 0 and winning % 2 = 0 then 2 else 0 end;
  elsif bet_id = 'odd' then
    return case when winning % 2 = 1 then 2 else 0 end;
  elsif bet_id = 'low' then
    return case when winning between 1 and 18 then 2 else 0 end;
  elsif bet_id = 'high' then
    return case when winning between 19 and 36 then 2 else 0 end;
  elsif bet_id = 'd-1' then
    return case when winning between 1 and 12 then 3 else 0 end;
  elsif bet_id = 'd-2' then
    return case when winning between 13 and 24 then 3 else 0 end;
  elsif bet_id = 'd-3' then
    return case when winning between 25 and 36 then 3 else 0 end;
  elsif bet_id = 'c-top' then
    return case when winning <> 0 and winning % 3 = 0 then 3 else 0 end;
  elsif bet_id = 'c-mid' then
    return case when winning % 3 = 2 then 3 else 0 end;
  elsif bet_id = 'c-bot' then
    return case when winning % 3 = 1 then 3 else 0 end;
  else
    return 0;
  end if;
end;
$$;

-- Server-authoritative roulette spin. Takes the player's bets as a jsonb map
-- of { bet_id: amount }, atomically deducts the total wager (failing if the
-- balance is short), picks the winning number server-side, pays out, and
-- records casino stats. The client animates the wheel to the returned number.
create or replace function public.roulette_spin(bets jsonb)
returns table (winning int, total_wagered int, total_return int, net int, new_points int)
language plpgsql
security definer
set search_path = public
as $$
declare
  k text;
  v int;
  wag int := 0;
  ret int := 0;
  win int;
  pts int;
  net_change int;
begin
  -- Tally + validate the wager.
  for k, v in select key, (value#>>'{}')::int from jsonb_each(bets) loop
    if v is null or v <= 0 then
      raise exception 'invalid bet amount for %', k;
    end if;
    wag := wag + v;
  end loop;
  if wag <= 0 then
    raise exception 'no bets placed';
  end if;

  select points into pts from public.profiles where user_id = auth.uid();
  if pts is null then
    raise exception 'no profile';
  end if;
  if pts < wag then
    raise exception 'insufficient points';
  end if;

  -- Server RNG owns the outcome.
  win := floor(random() * 37)::int;

  for k, v in select key, (value#>>'{}')::int from jsonb_each(bets) loop
    ret := ret + v * public.roulette_multiplier(k, win);
  end loop;

  net_change := ret - wag;

  update public.profiles
     set points             = points - wag + ret,
         -- Mirror spend_points (no lifetime change) + add_points(ret).
         lifetime_points    = lifetime_points + ret,
         casino_net         = casino_net + net_change,
         casino_biggest_win = greatest(casino_biggest_win, net_change),
         updated_at         = now()
   where user_id = auth.uid()
   returning points into pts;

  return query select win, wag, ret, net_change, pts;
end;
$$;

grant execute on function public.roulette_spin(jsonb) to authenticated;

-- Ride the Bus. Hybrid model like blackjack: the deal deducts and escrows the
-- stake, then settlement pays at most the legal max return (20x stake).
alter table public.profiles
  add column if not exists ride_bus_open_stake bigint not null default 0;

create or replace function public.ride_bus_deal_stake(amount int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pts int;
begin
  if amount is null or amount <= 0 then
    raise exception 'invalid stake';
  end if;

  select points into pts
    from public.profiles
   where user_id = auth.uid()
   for update;

  if pts is null then
    raise exception 'profile not found';
  end if;
  if pts < amount then
    raise exception 'insufficient points';
  end if;

  update public.profiles
     set points = points - amount,
         ride_bus_open_stake = amount,
         updated_at = now()
   where user_id = auth.uid();
end;
$$;
grant execute on function public.ride_bus_deal_stake(int) to authenticated;

create or replace function public.ride_bus_settle(payout int)
returns table (new_points int, net int)
language plpgsql
security definer
set search_path = public
as $$
declare
  staked bigint;
  paid int;
  net_change int;
  pts int;
begin
  if payout is null or payout < 0 then
    raise exception 'invalid payout';
  end if;

  select ride_bus_open_stake into staked
    from public.profiles
   where user_id = auth.uid()
   for update;

  if staked is null then
    raise exception 'profile not found';
  end if;

  paid := least(payout, cast(staked * 20 as int));
  net_change := paid - cast(staked as int);

  update public.profiles
     set points = points + paid,
         lifetime_points = lifetime_points + paid,
         casino_net = casino_net + net_change,
         casino_biggest_win = greatest(casino_biggest_win, net_change),
         ride_bus_open_stake = 0,
         updated_at = now()
   where user_id = auth.uid()
   returning points into pts;

  return query select pts, net_change;
end;
$$;
grant execute on function public.ride_bus_settle(int) to authenticated;

-- Record a casino round settled on the client (blackjack, hybrid model). Only
-- updates the cumulative/best stats; the actual points move via add_points /
-- spend_points. `net` may be negative.
create or replace function public.record_casino_result(net int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set casino_net         = casino_net + net,
         casino_biggest_win = greatest(casino_biggest_win, net),
         updated_at         = now()
   where user_id = auth.uid();
end;
$$;

grant execute on function public.record_casino_result(int) to authenticated;

-- Casino leaderboards (public-read, same shape as the others).
create or replace function public.get_leaderboard_casino_win(lim int default 100)
returns table (rank int, username text, score int)
language sql security definer set search_path = public
as $$
  select
    cast(row_number() over (order by p.casino_biggest_win desc) as int) as rank,
    p.username,
    p.casino_biggest_win as score
  from public.profiles p
  where p.username is not null and p.casino_biggest_win > 0
  order by p.casino_biggest_win desc
  limit lim;
$$;
grant execute on function public.get_leaderboard_casino_win(int) to anon, authenticated;

create or replace function public.get_leaderboard_casino_net(lim int default 100)
returns table (rank int, username text, score bigint)
language sql security definer set search_path = public
as $$
  select
    cast(row_number() over (order by p.casino_net desc) as int) as rank,
    p.username,
    p.casino_net as score
  from public.profiles p
  where p.username is not null and p.casino_net <> 0
  order by p.casino_net desc
  limit lim;
$$;
grant execute on function public.get_leaderboard_casino_net(int) to anon, authenticated;

-- Cases. Server-authoritative: the server owns the RNG and payout, mirroring
-- roulette_spin. The case item table here MUST match
-- src/games/cases/lib.ts exactly — same per-case item order (so item_index maps
-- to the same reward client-side), same integer weights (summing to 10000),
-- reward kinds, multipliers, cosmetic IDs, and duplicate profits.
drop function if exists public.cases_open(text, int);
create or replace function public.cases_open(case_id text, wager int)
returns table (
  item_index int,
  mult_x100 int,
  payout int,
  net int,
  new_points int,
  reward_kind text,
  unlock_id text,
  unlock_name text,
  duplicate boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  weights int[] := array[1700, 2450, 350, 2400, 880, 220, 1200, 300, 220, 180, 60, 40];
  kinds text[] := array['chips', 'chips', 'cosmetic', 'chips', 'chips', 'cosmetic', 'chips', 'cosmetic', 'chips', 'cosmetic', 'chips', 'cosmetic'];
  mults int[] := array[0, 40, 0, 85, 120, 0, 250, 0, 750, 0, 5000, 0];
  duplicate_profits int[] := array[0, 0, 100, 0, 0, 300, 0, 1200, 0, 5000, 0, 20000];
  unlock_ids text[] := array[null::text, null::text, 'mint', null::text, null::text, 'mono', null::text, 'prism', null::text, 'royal', null::text, 'casino-royale'];
  unlock_names text[] := array[null::text, null::text, 'mint theme', null::text, null::text, 'mono deck', null::text, 'prism theme', null::text, 'royal deck', null::text, 'casino royale theme'];
  total   int;
  r       int;
  acc     int := 0;
  idx     int := 0;
  mult    int;
  pay     int;
  net_change int;
  pts     int;
  current_unlocks text[];
  reward text;
  won_unlock_id text;
  won_unlock_name text;
  duplicate_hit boolean := false;
  duplicate_profit int := 0;
begin
  if wager is null or wager <= 0 then
    raise exception 'wager must be positive';
  end if;

  if case_id <> 'arcade' then
    raise exception 'unknown case';
  end if;

  -- Atomically lock, check, and later update the profile.
  select points, unlocks into pts, current_unlocks
    from public.profiles
   where user_id = auth.uid()
   for update;
  if pts is null then
    raise exception 'no profile';
  end if;
  if pts < wager then
    raise exception 'insufficient points';
  end if;

  -- Weighted draw (server-owned RNG).
  total := 0;
  for i in 1 .. array_length(weights, 1) loop
    total := total + weights[i];
  end loop;
  r := floor(random() * total)::int;
  for i in 1 .. array_length(weights, 1) loop
    acc := acc + weights[i];
    if r < acc then
      idx := i - 1;          -- 0-based index into the item list
      exit;
    end if;
  end loop;

  mult := mults[idx + 1];
  reward := kinds[idx + 1];
  won_unlock_id := unlock_ids[idx + 1];
  won_unlock_name := unlock_names[idx + 1];

  if reward = 'cosmetic' then
    duplicate_hit := coalesce(current_unlocks, array[]::text[]) @> array[won_unlock_id];
    if duplicate_hit then
      duplicate_profit := duplicate_profits[idx + 1];
    else
      mult := 0;
    end if;
  end if;

  pay  := (wager::bigint * mult / 100)::int;
  if duplicate_hit then
    pay := wager + duplicate_profit;
  end if;
  net_change := pay - wager;

  update public.profiles
     set points             = points - wager + pay,
         lifetime_points    = lifetime_points + pay,
         casino_net         = casino_net + net_change,
         casino_biggest_win = greatest(casino_biggest_win, net_change),
         unlocks            = case
                                when reward = 'cosmetic' and not duplicate_hit
                                  then array_append(coalesce(unlocks, array[]::text[]), won_unlock_id)
                                else unlocks
                              end,
         updated_at         = now()
   where user_id = auth.uid()
   returning points into pts;

  return query select
    idx,
    mult,
    pay,
    net_change,
    pts,
    reward,
    won_unlock_id,
    won_unlock_name,
    duplicate_hit;
end;
$$;
grant execute on function public.cases_open(text, int) to authenticated;

-- ===========================================================================
-- 2048
-- ===========================================================================

-- g2048_high_score stores the highest TILE the account has ever reached
-- (e.g. 2048), not a merge score.
alter table public.profiles
  add column if not exists g2048_high_score int not null default 0;

-- Remove earlier versions if a previous schema was applied.
drop function if exists public.submit_2048_result(int);
drop function if exists public.submit_2048_result(int, int);

-- One-time cleanup: clear any pre-existing values that aren't a valid tile
-- (leftovers from when this column held a merge score).
update public.profiles
   set g2048_high_score = 0
 where g2048_high_score > 0
   and (g2048_high_score > 131072 or (g2048_high_score & (g2048_high_score - 1)) <> 0);

-- Settle a 2048 run by the top tile reached. Updates the account's best tile
-- (the leaderboard) and awards points derived from the tile:
--   < 64 -> 0, then 64 -> 5, doubling each tile up (128 -> 10, 256 -> 20,
--   512 -> 40, 1024 -> 80, 2048 -> 160, 4096 -> 320, ...).
-- top_tile is validated as a power of two no larger than the 131072 a 4x4
-- board can reach, so a client can't fabricate it. Returns (best, reward).
create or replace function public.submit_2048_result(top_tile int)
returns table (best int, reward int)
language plpgsql security definer set search_path = public
as $$
declare
  current_best int;
  new_best     int;
  award        int;
begin
  -- top_tile must be 0 or a power of two within reach of a 4x4 board.
  if top_tile is null or top_tile < 0 or top_tile > 131072
     or (top_tile > 0 and (top_tile & (top_tile - 1)) <> 0) then
    raise exception 'top_tile out of plausible range';
  end if;

  -- Reward = 5 * (top_tile / 64), i.e. 5 at the 64 tile and doubling upward.
  if top_tile >= 64 then
    award := 5 * (top_tile / 64);
  else
    award := 0;
  end if;

  select g2048_high_score into current_best
    from public.profiles where user_id = auth.uid();
  new_best := greatest(coalesce(current_best, 0), top_tile);

  update public.profiles
     set g2048_high_score = new_best,
         points           = points + award,
         lifetime_points  = lifetime_points + award,
         updated_at       = now()
   where user_id = auth.uid();

  return query select new_best, award;
end;
$$;
grant execute on function public.submit_2048_result(int) to authenticated;

create or replace function public.get_leaderboard_2048(lim int default 100)
returns table (rank int, username text, score int)
language sql security definer set search_path = public
as $$
  select
    cast(row_number() over (order by p.g2048_high_score desc) as int) as rank,
    p.username,
    p.g2048_high_score as score
  from public.profiles p
  where p.username is not null and p.g2048_high_score > 0
  order by p.g2048_high_score desc
  limit lim;
$$;
grant execute on function public.get_leaderboard_2048(int) to anon, authenticated;

-- ===========================================================================
-- Tetris (Sprint 40L)
-- ===========================================================================

-- tetris_sprint_ms stores the account's best time (ms) to clear 40 lines.
-- NULL = no record. Lower is better (drives the Tetris Sprint leaderboard).
-- Locked down by hardening.sql (not in the cosmetic column grant), so it can
-- only change via submit_tetris_result below.
alter table public.profiles
  add column if not exists tetris_sprint_ms int;

drop function if exists public.submit_tetris_result(int, int);

-- Settle a completed 40-line Sprint. lines must equal 40 (only finished runs
-- count); the time is range-checked against a superhuman floor so a client
-- can't fabricate an impossible record. Updates the account best (via least)
-- and awards a bounded, time-tiered reward. Returns (best, reward).
--   40 base, +15 if under 2min, +30 if under 1min (bonuses stack).
--   (>=120s -> 40, <120s -> 55, <60s -> 85). Always in [40,85].
create or replace function public.submit_tetris_result(time_ms int, lines int)
returns table (best int, reward int)
language plpgsql security definer set search_path = public
as $$
declare
  current_best int;
  new_best     int;
  award        int;
begin
  if lines is null or lines <> 40 then
    raise exception 'a sprint result must clear exactly 40 lines';
  end if;
  -- Superhuman floor: the 40L world record is ~14s; reject anything under 8s.
  -- Upper bound guards against integer-overflow style garbage.
  if time_ms is null or time_ms < 8000 or time_ms > 3600000 then
    raise exception 'time_ms out of plausible range';
  end if;

  award := 40;
  if time_ms < 120000 then award := award + 15; end if; -- under 2 min
  if time_ms < 60000  then award := award + 30; end if; -- under 1 min

  select tetris_sprint_ms into current_best
    from public.profiles where user_id = auth.uid();
  new_best := least(coalesce(current_best, time_ms), time_ms);

  update public.profiles
     set tetris_sprint_ms = new_best,
         points           = points + award,
         lifetime_points  = lifetime_points + award,
         updated_at       = now()
   where user_id = auth.uid();

  return query select new_best, award;
end;
$$;
grant execute on function public.submit_tetris_result(int, int) to authenticated;

create or replace function public.get_leaderboard_tetris(lim int default 100)
returns table (rank int, username text, score int)
language sql security definer set search_path = public
as $$
  select
    cast(row_number() over (order by p.tetris_sprint_ms asc) as int) as rank,
    p.username,
    p.tetris_sprint_ms as score
  from public.profiles p
  where p.username is not null and p.tetris_sprint_ms is not null
  order by p.tetris_sprint_ms asc
  limit lim;
$$;
grant execute on function public.get_leaderboard_tetris(int) to anon, authenticated;

-- ===========================================================================
-- Daily Word (Wordle-style)
-- ===========================================================================

-- A date-seeded 5-letter puzzle, the same for everyone each UTC day. The
-- competitive metric is the solve streak. These columns change only via
-- submit_wordle_result (they are not in hardening.sql's cosmetic column grant).
--   wordle_last_day    UTC day index of the last submitted puzzle (null = none)
--   wordle_streak      current consecutive-day solve streak
--   wordle_best_streak max streak ever (drives the leaderboard)
--   wordle_wins        total puzzles solved
--   wordle_played      total puzzles attempted
alter table public.profiles
  add column if not exists wordle_last_day int,
  add column if not exists wordle_streak int not null default 0,
  add column if not exists wordle_best_streak int not null default 0,
  add column if not exists wordle_wins int not null default 0,
  add column if not exists wordle_played int not null default 0;

drop function if exists public.submit_wordle_result(int, int, boolean);

-- Settle today's puzzle. puzzle_day MUST equal the server's current UTC day
-- index (no backfilling streaks); guesses in 1..6. One submission per day
-- (idempotent — a second call that day no-ops). Solving continues the streak
-- only if the previous solved day was exactly yesterday; a loss resets it.
-- Awards a bounded, solve-only reward (more for fewer guesses).
--   reward = 5 + (6 - guesses) * 5  ->  30 (1 guess) .. 5 (6 guesses); 0 on loss.
create or replace function public.submit_wordle_result(puzzle_day int, guesses int, solved boolean)
returns table (streak int, best_streak int, reward int)
language plpgsql security definer set search_path = public
as $$
declare
  today      int := floor(extract(epoch from now()) / 86400)::int;
  last_day   int;
  cur_streak int;
  best       int;
  award      int := 0;
begin
  if puzzle_day is null or puzzle_day <> today then
    raise exception 'wordle submission must be for the current day';
  end if;
  if guesses is null or guesses < 1 or guesses > 6 then
    raise exception 'guesses out of range';
  end if;

  select wordle_last_day, wordle_streak, wordle_best_streak
    into last_day, cur_streak, best
    from public.profiles where user_id = auth.uid();

  cur_streak := coalesce(cur_streak, 0);
  best := coalesce(best, 0);

  -- Idempotent: already played today -> return current stats unchanged.
  if last_day is not null and last_day = today then
    return query select cur_streak, best, 0;
    return;
  end if;

  if solved then
    if last_day is not null and last_day = today - 1 then
      cur_streak := cur_streak + 1;
    else
      cur_streak := 1;
    end if;
    best := greatest(best, cur_streak);
    award := 5 + (6 - guesses) * 5;
  else
    cur_streak := 0;
  end if;

  update public.profiles
     set wordle_last_day    = today,
         wordle_streak      = cur_streak,
         wordle_best_streak = best,
         wordle_wins        = wordle_wins + (case when solved then 1 else 0 end),
         wordle_played      = wordle_played + 1,
         points             = points + award,
         lifetime_points    = lifetime_points + award,
         updated_at         = now()
   where user_id = auth.uid();

  return query select cur_streak, best, award;
end;
$$;
grant execute on function public.submit_wordle_result(int, int, boolean) to authenticated;

create or replace function public.get_leaderboard_wordle(lim int default 100)
returns table (rank int, username text, score int)
language sql security definer set search_path = public
as $$
  select
    cast(row_number() over (order by p.wordle_best_streak desc) as int) as rank,
    p.username,
    p.wordle_best_streak as score
  from public.profiles p
  where p.username is not null and p.wordle_best_streak > 0
  order by p.wordle_best_streak desc
  limit lim;
$$;
grant execute on function public.get_leaderboard_wordle(int) to anon, authenticated;

-- ===========================================================================
-- Minesweeper (timed, one best-time per difficulty)
-- ===========================================================================

-- Best clear time in ms per difficulty preset. NULL = no record. Lower is
-- better. These columns change only via submit_minesweeper_result (they are
-- not in hardening.sql's cosmetic column grant).
--   easy   = 9x9,   10 mines
--   medium = 16x16, 40 mines
--   hard   = 30x16, 99 mines
alter table public.profiles
  add column if not exists mines_easy_ms   int,
  add column if not exists mines_medium_ms int,
  add column if not exists mines_hard_ms   int;

drop function if exists public.submit_minesweeper_result(text, int);

-- Settle a won board. difficulty is one of easy/medium/hard; time_ms is range-
-- checked against a superhuman floor so a client can't fabricate an impossible
-- record. Updates the per-difficulty account best (via least) and awards a
-- bounded, difficulty-tiered reward (easy 10, medium 25, hard 50). The reward
-- is fixed per difficulty so it can't be inflated. Returns (best, reward).
create or replace function public.submit_minesweeper_result(difficulty text, time_ms int)
returns table (best int, reward int)
language plpgsql security definer set search_path = public
as $$
declare
  current_best int;
  new_best     int;
  award        int;
  floor_ms     int;
begin
  if difficulty not in ('easy', 'medium', 'hard') then
    raise exception 'unknown difficulty';
  end if;
  -- Per-difficulty superhuman floor + a generous upper bound against garbage.
  floor_ms := case difficulty
                when 'easy'   then 1000
                when 'medium' then 5000
                else 20000      -- hard
              end;
  if time_ms is null or time_ms < floor_ms or time_ms > 3600000 then
    raise exception 'time_ms out of plausible range';
  end if;

  award := case difficulty
             when 'easy'   then 10
             when 'medium' then 25
             else 50          -- hard
           end;

  if difficulty = 'easy' then
    select mines_easy_ms into current_best from public.profiles where user_id = auth.uid();
    new_best := least(coalesce(current_best, time_ms), time_ms);
    update public.profiles
       set mines_easy_ms   = new_best,
           points          = points + award,
           lifetime_points = lifetime_points + award,
           updated_at      = now()
     where user_id = auth.uid();
  elsif difficulty = 'medium' then
    select mines_medium_ms into current_best from public.profiles where user_id = auth.uid();
    new_best := least(coalesce(current_best, time_ms), time_ms);
    update public.profiles
       set mines_medium_ms = new_best,
           points          = points + award,
           lifetime_points = lifetime_points + award,
           updated_at      = now()
     where user_id = auth.uid();
  else
    select mines_hard_ms into current_best from public.profiles where user_id = auth.uid();
    new_best := least(coalesce(current_best, time_ms), time_ms);
    update public.profiles
       set mines_hard_ms   = new_best,
           points          = points + award,
           lifetime_points = lifetime_points + award,
           updated_at      = now()
     where user_id = auth.uid();
  end if;

  return query select new_best, award;
end;
$$;
grant execute on function public.submit_minesweeper_result(text, int) to authenticated;

-- Per-difficulty leaderboard: ranks by fastest clear time (ascending).
create or replace function public.get_leaderboard_minesweeper(diff text, lim int default 100)
returns table (rank int, username text, score int)
language sql security definer set search_path = public
as $$
  select
    cast(row_number() over (order by t.score asc) as int) as rank,
    t.username,
    t.score
  from (
    select p.username,
           case diff
             when 'easy'   then p.mines_easy_ms
             when 'medium' then p.mines_medium_ms
             when 'hard'   then p.mines_hard_ms
           end as score
    from public.profiles p
    where p.username is not null
  ) t
  where t.score is not null
  order by t.score asc
  limit lim;
$$;
grant execute on function public.get_leaderboard_minesweeper(text, int) to anon, authenticated;
