export const EQUATION_LENGTH = 8
export const MAX_GUESSES = 6

const MS_PER_DAY = 86_400_000
const LAUNCH_DAY = Math.floor(Date.UTC(2026, 0, 1) / MS_PER_DAY)
const ALLOWED = new Set('0123456789+-*/='.split(''))
const OPS = ['+', '-', '*', '/'] as const

export type MathdleState = 'correct' | 'present' | 'absent'

type Fraction = {
  n: number
  d: number
}

type Rng = () => number

const FALLBACK_EQUATIONS = [
  '12+34=46',
  '9*20=180',
  '84/7=12',
  '6*7-8=34',
  '90-12=78',
  '48/6+7=15',
  '5*9+8=53',
  '72/8+4=13',
]

export function dayIndex(now: number = Date.now()): number {
  return Math.floor(now / MS_PER_DAY)
}

export function puzzleNumber(day: number = dayIndex()): number {
  return day - LAUNCH_DAY + 1
}

export function msUntilNextDay(now: number = Date.now()): number {
  return (dayIndex(now) + 1) * MS_PER_DAY - now
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y !== 0) {
    const t = y
    y = x % y
    x = t
  }
  return x || 1
}

function frac(n: number, d = 1): Fraction | null {
  if (d === 0) return null
  const sign = d < 0 ? -1 : 1
  const g = gcd(n, d)
  return { n: (n / g) * sign, d: Math.abs(d) / g }
}

function add(a: Fraction, b: Fraction): Fraction {
  return frac(a.n * b.d + b.n * a.d, a.d * b.d)!
}

function sub(a: Fraction, b: Fraction): Fraction {
  return frac(a.n * b.d - b.n * a.d, a.d * b.d)!
}

function mul(a: Fraction, b: Fraction): Fraction {
  return frac(a.n * b.n, a.d * b.d)!
}

function div(a: Fraction, b: Fraction): Fraction | null {
  if (b.n === 0) return null
  return frac(a.n * b.d, a.d * b.n)
}

function equals(a: Fraction, b: Fraction): boolean {
  return a.n === b.n && a.d === b.d
}

function parseNumber(raw: string): Fraction | null {
  if (!/^\d+$/.test(raw)) return null
  if (raw.length > 1 && raw.startsWith('0')) return null
  return frac(Number(raw))
}

export function evaluateExpression(expr: string): Fraction | null {
  if (!expr) return null

  const values: Fraction[] = []
  const ops: string[] = []
  let i = 0
  let expectNumber = true

  while (i < expr.length) {
    if (expectNumber) {
      const start = i
      while (i < expr.length && /\d/.test(expr[i])) i += 1
      if (start === i) return null
      const value = parseNumber(expr.slice(start, i))
      if (!value) return null
      values.push(value)
      expectNumber = false
    } else {
      const op = expr[i]
      if (!OPS.includes(op as (typeof OPS)[number])) return null
      ops.push(op)
      i += 1
      expectNumber = true
    }
  }

  if (expectNumber || values.length === 0) return null

  const collapsed: Fraction[] = [values[0]]
  const lowOps: string[] = []
  for (let j = 0; j < ops.length; j += 1) {
    const op = ops[j]
    const right = values[j + 1]
    if (op === '*') {
      collapsed[collapsed.length - 1] = mul(collapsed[collapsed.length - 1], right)
    } else if (op === '/') {
      const next = div(collapsed[collapsed.length - 1], right)
      if (!next) return null
      collapsed[collapsed.length - 1] = next
    } else {
      lowOps.push(op)
      collapsed.push(right)
    }
  }

  let total = collapsed[0]
  for (let j = 0; j < lowOps.length; j += 1) {
    total = lowOps[j] === '+'
      ? add(total, collapsed[j + 1])
      : sub(total, collapsed[j + 1])
  }
  return total
}

export function isValidEquation(equation: string): boolean {
  if (equation.length !== EQUATION_LENGTH) return false
  if ([...equation].some((ch) => !ALLOWED.has(ch))) return false
  const parts = equation.split('=')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false
  const left = evaluateExpression(parts[0])
  const right = evaluateExpression(parts[1])
  return !!left && !!right && equals(left, right)
}

function mulberry32(seed: number): Rng {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

function randomInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

function randomNumber(rng: Rng): string {
  const digits = rng() < 0.68 ? 1 : 2
  if (digits === 1) return String(randomInt(rng, 0, 9))
  return `${randomInt(rng, 1, 9)}${randomInt(rng, 0, 9)}`
}

function randomOp(rng: Rng): string {
  const weighted = ['+', '-', '*', '*', '/', '+']
  return weighted[randomInt(rng, 0, weighted.length - 1)]
}

function buildCandidate(rng: Rng): string | null {
  const terms = rng() < 0.58 ? 2 : 3
  let expr = randomNumber(rng)
  for (let i = 1; i < terms; i += 1) {
    expr += randomOp(rng) + randomNumber(rng)
  }

  const value = evaluateExpression(expr)
  if (!value || value.d !== 1 || value.n < 0) return null
  const result = String(value.n)
  const candidate = `${expr}=${result}`
  return candidate.length === EQUATION_LENGTH && isValidEquation(candidate)
    ? candidate
    : null
}

export function equationForDay(day: number = dayIndex()): string {
  const rng = mulberry32((day * 2_654_435_761) >>> 0)
  for (let i = 0; i < 20_000; i += 1) {
    const candidate = buildCandidate(rng)
    if (candidate) return candidate
  }
  return FALLBACK_EQUATIONS[((day % FALLBACK_EQUATIONS.length) + FALLBACK_EQUATIONS.length) % FALLBACK_EQUATIONS.length]
}

export function evaluateGuess(guess: string, answer: string): MathdleState[] {
  const result: MathdleState[] = new Array(EQUATION_LENGTH).fill('absent')
  const counts: Record<string, number> = {}
  for (const ch of answer) counts[ch] = (counts[ch] ?? 0) + 1

  for (let i = 0; i < EQUATION_LENGTH; i += 1) {
    if (guess[i] === answer[i]) {
      result[i] = 'correct'
      counts[guess[i]] -= 1
    }
  }

  for (let i = 0; i < EQUATION_LENGTH; i += 1) {
    if (result[i] === 'correct') continue
    const ch = guess[i]
    if (counts[ch] > 0) {
      result[i] = 'present'
      counts[ch] -= 1
    }
  }

  return result
}

export function aggregateKeyStates(
  guesses: string[],
  answer: string,
): Record<string, MathdleState> {
  const rank: Record<MathdleState, number> = { absent: 0, present: 1, correct: 2 }
  const out: Record<string, MathdleState> = {}
  for (const guess of guesses) {
    const states = evaluateGuess(guess, answer)
    for (let i = 0; i < EQUATION_LENGTH; i += 1) {
      const ch = guess[i]
      const state = states[i]
      if (!(ch in out) || rank[state] > rank[out[ch]]) out[ch] = state
    }
  }
  return out
}

export function shareGrid(guesses: string[], answer: string): string {
  const tile: Record<MathdleState, string> = {
    correct: 'G',
    present: 'P',
    absent: '-',
  }
  return guesses
    .map((guess) => evaluateGuess(guess, answer).map((state) => tile[state]).join(''))
    .join('\n')
}
