// Pure logic for Daily Word — no React, no Supabase. The same day-index math is
// mirrored server-side in submit_wordle_result so client and server agree on
// which puzzle is "today".
import { WORDS, WORD_SET } from './words'
import { ALLOWED_SET } from './allowed'

export const WORD_LENGTH = 5
export const MAX_GUESSES = 6

const MS_PER_DAY = 86_400_000
// Puzzle #1 = 2026-01-01 (UTC). Only affects the displayed puzzle number.
const LAUNCH_DAY = Math.floor(Date.UTC(2026, 0, 1) / MS_PER_DAY)

/** Whether a tile/letter is in the right spot, in the word, or absent. */
export type LetterState = 'correct' | 'present' | 'absent'

/** UTC day index (days since the Unix epoch). Matches floor(epoch_s / 86400). */
export function dayIndex(now: number = Date.now()): number {
  return Math.floor(now / MS_PER_DAY)
}

/** Human-facing puzzle number (Puzzle #1 on the launch day). */
export function puzzleNumber(day: number = dayIndex()): number {
  return day - LAUNCH_DAY + 1
}

/** The answer for a given day, rotating deterministically through the list. */
export function wordForDay(day: number = dayIndex()): string {
  return WORDS[((day % WORDS.length) + WORDS.length) % WORDS.length]
}

/**
 * A guess is playable if it is in the large allowed-guesses dictionary
 * (allowed.ts) or the curated answer pool (words.ts) — the latter guarantees
 * every possible answer is always guessable even if it isn't in word-list.
 */
export function isValidWord(guess: string): boolean {
  const g = guess.toLowerCase()
  return ALLOWED_SET.has(g) || WORD_SET.has(g)
}

/**
 * Evaluate a guess against the answer with correct duplicate-letter handling:
 * exact matches are marked first and consume that letter, so a second copy only
 * goes yellow if the answer still has an unmatched instance.
 */
export function evaluateGuess(guess: string, answer: string): LetterState[] {
  const g = guess.toLowerCase()
  const a = answer.toLowerCase()
  const result: LetterState[] = new Array(WORD_LENGTH).fill('absent')
  const counts: Record<string, number> = {}
  for (const ch of a) counts[ch] = (counts[ch] ?? 0) + 1

  // Pass 1: greens.
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (g[i] === a[i]) {
      result[i] = 'correct'
      counts[g[i]]--
    }
  }
  // Pass 2: yellows from whatever letters remain.
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === 'correct') continue
    const ch = g[i]
    if (counts[ch] > 0) {
      result[i] = 'present'
      counts[ch]--
    }
  }
  return result
}

/**
 * Best-known state per letter across all submitted guesses, for coloring the
 * on-screen keyboard. Priority: correct > present > absent.
 */
export function aggregateKeyStates(
  guesses: string[],
  answer: string,
): Record<string, LetterState> {
  const rank: Record<LetterState, number> = { absent: 0, present: 1, correct: 2 }
  const out: Record<string, LetterState> = {}
  for (const guess of guesses) {
    const states = evaluateGuess(guess, answer)
    for (let i = 0; i < WORD_LENGTH; i++) {
      const ch = guess[i].toLowerCase()
      const s = states[i]
      if (!(ch in out) || rank[s] > rank[out[ch]]) out[ch] = s
    }
  }
  return out
}

/** Milliseconds until the next UTC midnight (drives the next-puzzle countdown). */
export function msUntilNextDay(now: number = Date.now()): number {
  return (dayIndex(now) + 1) * MS_PER_DAY - now
}

/** Emoji grid for the share feature (one row of squares per guess). */
export function shareGrid(guesses: string[], answer: string): string {
  const tile: Record<LetterState, string> = {
    correct: '🟩',
    present: '🟨',
    absent: '⬛',
  }
  return guesses
    .map((g) => evaluateGuess(g, answer).map((s) => tile[s]).join(''))
    .join('\n')
}
