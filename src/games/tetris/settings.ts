// Persistent, user-tunable Tetris settings: handling (DAS/ARR/SDF) + keybinds.
// Pure module — no React. Loaded once at mount, mutated live through refs in
// TetrisGame, and persisted to localStorage so they survive reloads.

export type Handling = {
  das: number // delay before auto-shift kicks in (ms)
  arr: number // auto-shift repeat interval (ms); 0 = slam to wall
  sdf: number // soft drop interval (ms per cell); 0 = instant (sonic) drop
}

export type TetrisAction =
  | 'moveLeft'
  | 'moveRight'
  | 'softDrop'
  | 'hardDrop'
  | 'rotateCW'
  | 'rotateCCW'
  | 'rotate180'
  | 'hold'

// Each action maps to one or more physical key codes (KeyboardEvent.code).
// Codes are layout-position based, which is the convention for games.
export type Keymap = Record<TetrisAction, string[]>

export const DEFAULT_HANDLING: Handling = { das: 130, arr: 20, sdf: 18 }

export const DEFAULT_KEYMAP: Keymap = {
  moveLeft: ['ArrowLeft'],
  moveRight: ['ArrowRight'],
  softDrop: ['ArrowDown'],
  hardDrop: ['Space'],
  rotateCW: ['ArrowUp', 'KeyX'],
  rotateCCW: ['KeyZ', 'ControlLeft'],
  rotate180: ['KeyA'],
  hold: ['ShiftLeft', 'KeyC'],
}

// Bounds for the handling sliders (also used to clamp loaded values).
export const HANDLING_BOUNDS: Record<keyof Handling, { min: number; max: number; step: number }> = {
  das: { min: 0, max: 300, step: 5 },
  arr: { min: 0, max: 100, step: 1 },
  sdf: { min: 0, max: 60, step: 1 },
}

// Display order + labels for the settings UI.
export const ACTION_ORDER: TetrisAction[] = [
  'moveLeft',
  'moveRight',
  'softDrop',
  'hardDrop',
  'rotateCW',
  'rotateCCW',
  'rotate180',
  'hold',
]

export const ACTION_LABELS: Record<TetrisAction, string> = {
  moveLeft: 'Move left',
  moveRight: 'Move right',
  softDrop: 'Soft drop',
  hardDrop: 'Hard drop',
  rotateCW: 'Rotate CW',
  rotateCCW: 'Rotate CCW',
  rotate180: 'Rotate 180',
  hold: 'Hold',
}

const HANDLING_KEY = 'minigames:tetris:handling'
const KEYMAP_KEY = 'minigames:tetris:keybinds'
const MAX_BINDS_PER_ACTION = 2

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min
  return Math.min(max, Math.max(min, Math.round(v)))
}

export function loadHandling(): Handling {
  try {
    const raw = localStorage.getItem(HANDLING_KEY)
    if (!raw) return { ...DEFAULT_HANDLING }
    const p = JSON.parse(raw) as Partial<Handling>
    return {
      das: clamp(p.das ?? DEFAULT_HANDLING.das, HANDLING_BOUNDS.das.min, HANDLING_BOUNDS.das.max),
      arr: clamp(p.arr ?? DEFAULT_HANDLING.arr, HANDLING_BOUNDS.arr.min, HANDLING_BOUNDS.arr.max),
      sdf: clamp(p.sdf ?? DEFAULT_HANDLING.sdf, HANDLING_BOUNDS.sdf.min, HANDLING_BOUNDS.sdf.max),
    }
  } catch {
    return { ...DEFAULT_HANDLING }
  }
}

export function saveHandling(h: Handling): void {
  try {
    localStorage.setItem(HANDLING_KEY, JSON.stringify(h))
  } catch {
    /* storage unavailable — settings just won't persist */
  }
}

export function loadKeymap(): Keymap {
  try {
    const raw = localStorage.getItem(KEYMAP_KEY)
    if (!raw) return cloneKeymap(DEFAULT_KEYMAP)
    const p = JSON.parse(raw) as Partial<Record<TetrisAction, unknown>>
    const out = cloneKeymap(DEFAULT_KEYMAP)
    for (const action of ACTION_ORDER) {
      const codes = p[action]
      if (Array.isArray(codes)) {
        const valid = codes.filter((c): c is string => typeof c === 'string').slice(0, MAX_BINDS_PER_ACTION)
        out[action] = valid
      }
    }
    return out
  } catch {
    return cloneKeymap(DEFAULT_KEYMAP)
  }
}

export function saveKeymap(k: Keymap): void {
  try {
    localStorage.setItem(KEYMAP_KEY, JSON.stringify(k))
  } catch {
    /* storage unavailable */
  }
}

export function cloneKeymap(k: Keymap): Keymap {
  const out = {} as Keymap
  for (const action of ACTION_ORDER) out[action] = [...k[action]]
  return out
}

// Build a reverse lookup (code -> action) consumed by the input handler.
// First action to claim a code wins; assignKey keeps codes unique anyway.
export function buildCodeMap(k: Keymap): Map<string, TetrisAction> {
  const map = new Map<string, TetrisAction>()
  for (const action of ACTION_ORDER) {
    for (const code of k[action]) {
      if (!map.has(code)) map.set(code, action)
    }
  }
  return map
}

// Bind `code` to `action` at a specific slot (replacing whatever was there).
// Codes are globally unique, so the code is first stripped from every action.
// Returns a fresh keymap (immutable update).
export function assignKey(k: Keymap, action: TetrisAction, slot: number, code: string): Keymap {
  const out = cloneKeymap(k)
  for (const a of ACTION_ORDER) out[a] = out[a].filter((c) => c !== code)
  const arr = out[action]
  arr[slot] = code // fills the slot (may extend the array by one)
  out[action] = arr.filter(Boolean).slice(0, MAX_BINDS_PER_ACTION)
  return out
}

export function clearKey(k: Keymap, action: TetrisAction, code: string): Keymap {
  const out = cloneKeymap(k)
  out[action] = out[action].filter((c) => c !== code)
  return out
}

export { MAX_BINDS_PER_ACTION }

// Friendly label for a KeyboardEvent.code (e.g. 'KeyX' -> 'X', 'ArrowLeft' -> '←').
export function keyLabel(code: string): string {
  const specials: Record<string, string> = {
    ArrowLeft: '←',
    ArrowRight: '→',
    ArrowUp: '↑',
    ArrowDown: '↓',
    Space: 'Space',
    ShiftLeft: 'L-Shift',
    ShiftRight: 'R-Shift',
    ControlLeft: 'L-Ctrl',
    ControlRight: 'R-Ctrl',
    AltLeft: 'L-Alt',
    AltRight: 'R-Alt',
    Enter: 'Enter',
    Tab: 'Tab',
    Backspace: 'Bksp',
    CapsLock: 'Caps',
  }
  if (specials[code]) return specials[code]
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`
  return code
}
