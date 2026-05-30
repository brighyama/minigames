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

  // --- Green tier ---
  aqua: {
    light: '#bfeef0',
    dark: '#0e6e7a',
    hint: 'rgba(8, 60, 66, 0.42)',
    capture: 'rgba(255, 240, 170, 0.8)',
  },
  sakura: {
    light: '#ffd6e2',
    dark: '#8a3a63',
    hint: 'rgba(90, 30, 60, 0.4)',
    capture: 'rgba(255, 239, 150, 0.82)',
  },

  // --- Blue tier ---
  sunset: {
    light: '#ffcf9e',
    dark: '#a01e52',
    hint: 'rgba(255, 220, 180, 0.45)',
    capture: 'rgba(255, 225, 110, 0.82)',
  },
  glacier: {
    light: '#cfe8f5',
    dark: '#244a5c',
    hint: 'rgba(20, 50, 64, 0.42)',
    capture: 'rgba(255, 238, 170, 0.8)',
  },

  // --- Purple tier ---
  amethyst: {
    light: '#d8c7f0',
    dark: '#45227a',
    hint: 'rgba(210, 190, 255, 0.46)',
    capture: 'rgba(255, 220, 120, 0.82)',
  },
  verdant: {
    light: '#b7f0d0',
    dark: '#14583f',
    hint: 'rgba(6, 50, 36, 0.42)',
    capture: 'rgba(255, 235, 150, 0.8)',
  },

  // --- Red tier ---
  synthwave: {
    light: '#b98ad6',
    dark: '#2a1255',
    hint: 'rgba(255, 42, 109, 0.45)',
    capture: 'rgba(5, 217, 232, 0.85)',
  },
  inferno: {
    light: '#f3a86b',
    dark: '#5a1a0c',
    hint: 'rgba(255, 210, 150, 0.45)',
    capture: 'rgba(255, 208, 0, 0.85)',
  },

  // --- Gold tier ---
  celestial: {
    light: '#ddc9a8',
    dark: '#241a5e',
    hint: 'rgba(255, 231, 163, 0.5)',
    capture: 'rgba(255, 207, 110, 0.88)',
  },
  eclipse: {
    light: '#b9a8d8',
    dark: '#150a22',
    hint: 'rgba(0, 240, 255, 0.45)',
    capture: 'rgba(176, 107, 255, 0.85)',
  },
}

export function applyChessPalette(root: HTMLElement, themeId: string) {
  const palette = CHESS_PALETTES[themeId]
  root.style.setProperty('--chess-light', palette?.light ?? DEFAULT_LIGHT)
  root.style.setProperty('--chess-dark', palette?.dark ?? DEFAULT_DARK)
  root.style.setProperty('--chess-hint', palette?.hint ?? 'rgba(70, 38, 12, 0.38)')
  root.style.setProperty('--chess-capture', palette?.capture ?? 'rgba(255, 214, 102, 0.76)')
}
