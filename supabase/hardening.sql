-- Security hardening — run in the Supabase SQL Editor AFTER schema.sql.
-- Goal: no client can inject points or fabricate leaderboard scores. Every
-- point that enters the system is computed/owned server-side. Safe to re-run.
--
-- Summary of what this closes:
--   1. Direct table writes to economic columns (points, scores, casino_*).
--   2. The generic add_points(amount) "give me N points" endpoint.
--   3. Unbounded reaction/aim rewards (client used to pass the amount).
--   4. Implausible leaderboard entries (1ms reaction, 1e9 aim score).
--   5. Client-declared blackjack payouts (now capped to the real wager).
-- Residuals (documented at the bottom): cosmetic `unlocks`, and a scripted
-- "always claim the max blackjack payout" grind. See notes at end.

-- ===========================================================================
-- 1. Column-level write lockdown.
--    Supabase grants the authenticated role full column UPDATE/INSERT on public
--    tables by default; RLS only gates *rows*. Strip that and re-grant writes to
--    cosmetic columns only. Economic columns now change solely via the RPCs.
-- ===========================================================================

revoke insert, update on public.profiles from authenticated;
revoke insert, update on public.profiles from anon;

grant update (username, theme_id, unlocks, updated_at)
  on public.profiles to authenticated;
grant insert (user_id, username, theme_id, unlocks, updated_at)
  on public.profiles to authenticated;

-- Defense in depth: a user can never repoint their own row to another user.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = user_id);

-- ===========================================================================
-- 2. Retire the generic point-injection endpoints. After the game-specific
--    RPCs below exist, nothing should call these from the client.
-- ===========================================================================

revoke execute on function public.add_points(int) from authenticated, anon;
revoke execute on function public.record_casino_result(int) from authenticated, anon;

-- ===========================================================================
-- 3. Plausibility guards on the leaderboard writers.
--    Human reaction floor ~100ms; aim is one circle at a time in a 20s round,
--    so >200 is physically impossible. Reject obviously fabricated values.
-- ===========================================================================

create or replace function public.update_reaction_best(avg_ms int)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  current_best int;
begin
  if avg_ms is null or avg_ms < 100 then
    raise exception 'avg_ms out of plausible range';
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
  if score is null or score < 0 or score > 200 then
    raise exception 'score out of plausible range';
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

-- ===========================================================================
-- 4. Server-computed game rewards. The client passes the performance metric;
--    the server derives the (bounded) point award. Mirrors the old client
--    formulas exactly so payouts are unchanged for honest play.
-- ===========================================================================

-- Reaction: 10 pts at <=250ms avg, -1 per 10ms above, floored at 5. Award is
-- always in [5,10] regardless of input, so it can't be inflated.
create or replace function public.award_reaction(best_avg_ms int)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  reward int;
begin
  if best_avg_ms is null or best_avg_ms < 100 then
    raise exception 'best_avg_ms out of plausible range';
  end if;
  if best_avg_ms <= 250 then
    reward := 10;
  else
    reward := greatest(5, 10 - ((best_avg_ms - 250) / 10));
  end if;
  update public.profiles
     set points          = points + reward,
         lifetime_points = lifetime_points + reward,
         updated_at      = now()
   where user_id = auth.uid();
  return reward;
end;
$$;
grant execute on function public.award_reaction(int) to authenticated;

-- Aim: 5 + floor(score/2). Score is clamped to the plausible ceiling first,
-- so the award is bounded at 5 + 100 = 105.
create or replace function public.award_aim(best_score int)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  s int;
  reward int;
begin
  if best_score is null or best_score < 0 then
    raise exception 'best_score out of range';
  end if;
  s := least(best_score, 200);
  reward := 5 + (s / 2);
  update public.profiles
     set points          = points + reward,
         lifetime_points = lifetime_points + reward,
         updated_at      = now()
   where user_id = auth.uid();
  return reward;
end;
$$;
grant execute on function public.award_aim(int) to authenticated;

-- ===========================================================================
-- 5. Blackjack: server-escrowed stakes + payout capped to the real wager.
--    Stakes are deducted the instant a bet is committed (so abandoning a
--    losing hand can't dodge the loss), and accumulated in bj_open_stake.
--    Settlement pays out at most 2.5x the accumulated stake — the maximum a
--    legal blackjack round can return — so the client can't declare a bogus
--    payout. Replaces the old spend_points + add_points + record_casino_result.
-- ===========================================================================

alter table public.profiles
  add column if not exists bj_open_stake bigint not null default 0;

-- First stake of a round (the deal). Resets the accumulator so a previously
-- abandoned round can't inflate this round's payout cap.
create or replace function public.blackjack_deal_stake(amount int)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  pts int;
begin
  if amount is null or amount <= 0 then
    raise exception 'amount must be positive';
  end if;
  select points into pts from public.profiles where user_id = auth.uid();
  if pts is null or pts < amount then
    raise exception 'insufficient points';
  end if;
  update public.profiles
     set points        = points - amount,
         bj_open_stake = amount,
         updated_at    = now()
   where user_id = auth.uid();
end;
$$;
grant execute on function public.blackjack_deal_stake(int) to authenticated;

-- Additional in-round stakes: double / split / insurance.
create or replace function public.blackjack_add_stake(amount int)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  pts int;
begin
  if amount is null or amount <= 0 then
    raise exception 'amount must be positive';
  end if;
  select points into pts from public.profiles where user_id = auth.uid();
  if pts is null or pts < amount then
    raise exception 'insufficient points';
  end if;
  update public.profiles
     set points        = points - amount,
         bj_open_stake = bj_open_stake + amount,
         updated_at    = now()
   where user_id = auth.uid();
end;
$$;
grant execute on function public.blackjack_add_stake(int) to authenticated;

-- Settle the round. payout = total points returned to the player (0 on a loss).
-- Capped at 2.5x the accumulated stake. Clears the accumulator and records
-- casino stats. Returns the new points balance.
create or replace function public.blackjack_settle(payout int)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  staked bigint;
  paid   int;
  net    int;
  pts    int;
begin
  if payout is null or payout < 0 then
    raise exception 'payout must be non-negative';
  end if;
  select bj_open_stake into staked from public.profiles where user_id = auth.uid();
  if staked is null or staked <= 0 then
    -- No open round (e.g. duplicate settle). Nothing to pay.
    select points into pts from public.profiles where user_id = auth.uid();
    return pts;
  end if;

  -- Cap to the maximum a legal blackjack round can return: 2.5x total wagered.
  paid := least(payout, (staked * 5 / 2)::int);
  net  := paid - staked::int;

  update public.profiles
     set points             = points + paid,
         lifetime_points    = lifetime_points + paid,
         casino_net         = casino_net + net,
         casino_biggest_win = greatest(casino_biggest_win, net),
         bj_open_stake      = 0,
         updated_at         = now()
   where user_id = auth.uid()
   returning points into pts;
  return pts;
end;
$$;
grant execute on function public.blackjack_settle(int) to authenticated;

-- ===========================================================================
-- Residual risks (acceptable for a portfolio arcade; raise the bar later if
-- desired):
--   * `unlocks` stays client-writable, so a determined user could grant
--     themselves shop cosmetics for free. No points/leaderboard impact. Move
--     purchases into a server RPC with a prices table to close this.
--   * A scripted user could loop blackjack_deal_stake + blackjack_settle always
--     claiming the 2.5x cap, netting a guaranteed profit. This requires
--     deliberately scripting the RPCs (far beyond opening devtools once).
--     Fully closing it means dealing cards server-side like roulette_spin.
-- ===========================================================================
