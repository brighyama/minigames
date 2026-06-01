const DEFAULT_LIGHT = '#d7b38c'
const DEFAULT_DARK = '#7a4f2b'

const CHESS_PALETTES: Record<string, { light: string; dark: string; hint: string; capture: string }> = {
  mint: {
    light: '#c7f4df',
    dark: '#20836f',
    hint: 'rgba(6, 60, 47, 0.42)',
    capture: 'rgba(255, 238, 170, 0.78)',
  },
  notebook: {
    light: '#e7edf7',
    dark: '#41526d',
    hint: 'rgba(97, 160, 255, 0.42)',
    capture: 'rgba(245, 200, 75, 0.82)',
  },
  arcade: {
    light: '#b8f7ce',
    dark: '#1c5a3f',
    hint: 'rgba(90, 255, 161, 0.42)',
    capture: 'rgba(255, 209, 102, 0.82)',
  },
  candy: {
    light: '#ffd1ec',
    dark: '#7867d8',
    hint: 'rgba(255, 255, 255, 0.45)',
    capture: 'rgba(255, 246, 156, 0.82)',
  },
  sunset: {
    light: '#ffcf9e',
    dark: '#a01e52',
    hint: 'rgba(255, 220, 180, 0.45)',
    capture: 'rgba(255, 225, 110, 0.82)',
  },
  blueprint: {
    light: '#bfe8ff',
    dark: '#123a5d',
    hint: 'rgba(115, 211, 255, 0.42)',
    capture: 'rgba(255, 176, 0, 0.82)',
  },
  aurora: {
    light: '#bff8ef',
    dark: '#35206b',
    hint: 'rgba(94, 234, 212, 0.46)',
    capture: 'rgba(168, 85, 247, 0.82)',
  },
  prism: {
    light: '#d9f8ff',
    dark: '#39214f',
    hint: 'rgba(255, 76, 163, 0.42)',
    capture: 'rgba(255, 204, 102, 0.82)',
  },
  overgrowth: {
    light: '#b7f0d0',
    dark: '#14583f',
    hint: 'rgba(6, 50, 36, 0.42)',
    capture: 'rgba(255, 235, 150, 0.8)',
  },
  midnight: {
    light: '#9894d8',
    dark: '#242047',
    hint: 'rgba(199, 190, 255, 0.48)',
    capture: 'rgba(255, 212, 94, 0.82)',
  },
  synthwave: {
    light: '#b98ad6',
    dark: '#2a1255',
    hint: 'rgba(255, 42, 109, 0.45)',
    capture: 'rgba(5, 217, 232, 0.85)',
  },
  voltage: {
    light: '#dce9ff',
    dark: '#122b66',
    hint: 'rgba(250, 255, 0, 0.42)',
    capture: 'rgba(44, 123, 255, 0.85)',
  },
  noir: {
    light: '#d8d8d8',
    dark: '#151515',
    hint: 'rgba(255, 255, 255, 0.38)',
    capture: 'rgba(222, 184, 85, 0.82)',
  },
  celestial: {
    light: '#ddc9a8',
    dark: '#241a5e',
    hint: 'rgba(255, 231, 163, 0.5)',
    capture: 'rgba(255, 207, 110, 0.88)',
  },
  'casino-royale': {
    light: '#d7bf74',
    dark: '#0d4a31',
    hint: 'rgba(255, 215, 100, 0.48)',
    capture: 'rgba(185, 28, 28, 0.82)',
  },
}

export function applyChessPalette(root: HTMLElement, themeId: string) {
  const palette = CHESS_PALETTES[themeId]
  root.style.setProperty('--chess-light', palette?.light ?? DEFAULT_LIGHT)
  root.style.setProperty('--chess-dark', palette?.dark ?? DEFAULT_DARK)
  root.style.setProperty('--chess-hint', palette?.hint ?? 'rgba(70, 38, 12, 0.38)')
  root.style.setProperty('--chess-capture', palette?.capture ?? 'rgba(255, 214, 102, 0.76)')
}
