const DEFAULT_LIGHT = '#d7b38c'
const DEFAULT_DARK = '#7a4f2b'

const CHESS_PALETTES: Record<string, { light: string; dark: string; hint: string; capture: string }> = {
  mint: {
    light: '#c7f4df',
    dark: '#20836f',
    hint: 'rgba(6, 60, 47, 0.42)',
    capture: 'rgba(255, 238, 170, 0.78)',
  },
  candy: {
    light: '#ffd1ec',
    dark: '#7867d8',
    hint: 'rgba(255, 255, 255, 0.45)',
    capture: 'rgba(255, 246, 156, 0.82)',
  },
  ember: {
    light: '#f5b36d',
    dark: '#7f241c',
    hint: 'rgba(255, 229, 181, 0.45)',
    capture: 'rgba(255, 214, 72, 0.8)',
  },
  midnight: {
    light: '#9894d8',
    dark: '#242047',
    hint: 'rgba(199, 190, 255, 0.48)',
    capture: 'rgba(255, 212, 94, 0.82)',
  },
  noir: {
    light: '#d8d8d8',
    dark: '#151515',
    hint: 'rgba(255, 255, 255, 0.38)',
    capture: 'rgba(222, 184, 85, 0.82)',
  },
}

export function applyChessPalette(root: HTMLElement, themeId: string) {
  const palette = CHESS_PALETTES[themeId]
  root.style.setProperty('--chess-light', palette?.light ?? DEFAULT_LIGHT)
  root.style.setProperty('--chess-dark', palette?.dark ?? DEFAULT_DARK)
  root.style.setProperty('--chess-hint', palette?.hint ?? 'rgba(70, 38, 12, 0.38)')
  root.style.setProperty('--chess-capture', palette?.capture ?? 'rgba(255, 214, 102, 0.76)')
}
