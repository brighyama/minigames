import { useEffect, useState } from 'react'
import {
  ACTION_LABELS,
  ACTION_ORDER,
  assignKey,
  clearKey,
  cloneKeymap,
  DEFAULT_HANDLING,
  DEFAULT_KEYMAP,
  HANDLING_BOUNDS,
  keyLabel,
  MAX_BINDS_PER_ACTION,
  type Handling,
  type Keymap,
  type TetrisAction,
} from './settings'

type Props = {
  handling: Handling
  keymap: Keymap
  onChangeHandling: (patch: Partial<Handling>) => void
  onChangeKeymap: (next: Keymap) => void
  onClose: () => void
}

const HANDLING_FIELDS: { key: keyof Handling; label: string; hint: string }[] = [
  { key: 'das', label: 'DAS', hint: 'delay before auto-shift (ms)' },
  { key: 'arr', label: 'ARR', hint: 'auto-shift repeat (ms) · 0 = instant' },
  { key: 'sdf', label: 'SDF', hint: 'soft drop speed (ms/cell) · 0 = instant' },
]

export function TetrisSettings({
  handling,
  keymap,
  onChangeHandling,
  onChangeKeymap,
  onClose,
}: Props) {
  // Which action slot is currently capturing a key, if any.
  const [listening, setListening] = useState<{ action: TetrisAction; slot: number } | null>(null)

  // While listening, grab the next key in the capture phase so it never reaches
  // the game's own (bubble-phase) input handler. Escape cancels.
  useEffect(() => {
    if (!listening) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.code === 'Escape') {
        setListening(null)
        return
      }
      onChangeKeymap(assignKey(keymap, listening.action, listening.slot, e.code))
      setListening(null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [listening, keymap, onChangeKeymap])

  const resetAll = () => {
    onChangeHandling({ ...DEFAULT_HANDLING })
    onChangeKeymap(cloneKeymap(DEFAULT_KEYMAP))
    setListening(null)
  }

  return (
    <div className="tetris-settings-backdrop" onClick={onClose}>
      <div
        className="tetris-settings"
        role="dialog"
        aria-label="Tetris settings"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tetris-settings-head">
          <h2 className="tetris-settings-title">settings</h2>
          <button className="tetris-settings-close" onClick={onClose} aria-label="Close settings">
            ✕
          </button>
        </div>

        <section className="tetris-settings-section">
          <h3 className="tetris-settings-subtitle">handling</h3>
          {HANDLING_FIELDS.map(({ key, label, hint }) => {
            const b = HANDLING_BOUNDS[key]
            const value = handling[key]
            return (
              <div className="tetris-set-row" key={key}>
                <div className="tetris-set-label">
                  <span className="tetris-set-name">{label}</span>
                  <span className="tetris-set-hint">{hint}</span>
                </div>
                <div className="tetris-set-control">
                  <input
                    type="range"
                    min={b.min}
                    max={b.max}
                    step={b.step}
                    value={value}
                    onChange={(e) => onChangeHandling({ [key]: Number(e.target.value) } as Partial<Handling>)}
                  />
                  <span className="tetris-set-value">{value === 0 ? 'instant' : value}</span>
                </div>
              </div>
            )
          })}
        </section>

        <section className="tetris-settings-section">
          <h3 className="tetris-settings-subtitle">controls</h3>
          <p className="tetris-settings-note">click a key, then press a new one to rebind</p>
          {ACTION_ORDER.map((action) => (
            <div className="tetris-set-row" key={action}>
              <div className="tetris-set-label">
                <span className="tetris-set-name">{ACTION_LABELS[action]}</span>
              </div>
              <div className="tetris-keybinds">
                {Array.from({ length: MAX_BINDS_PER_ACTION }).map((_, slot) => {
                  const code = keymap[action][slot]
                  const isListening =
                    listening?.action === action && listening?.slot === slot
                  return (
                    <span className="tetris-keybind-slot" key={slot}>
                      <button
                        className={`tetris-keybind${isListening ? ' is-listening' : ''}`}
                        onClick={() => setListening({ action, slot })}
                      >
                        {isListening ? '…' : code ? keyLabel(code) : '+'}
                      </button>
                      {code && !isListening && (
                        <button
                          className="tetris-keybind-clear"
                          aria-label={`Clear ${ACTION_LABELS[action]} binding`}
                          onClick={() => onChangeKeymap(clearKey(keymap, action, code))}
                        >
                          ✕
                        </button>
                      )}
                    </span>
                  )
                })}
              </div>
            </div>
          ))}
        </section>

        <div className="tetris-settings-actions">
          <button className="tetris-btn" onClick={resetAll}>
            reset to defaults
          </button>
          <button className="tetris-btn tetris-btn-primary" onClick={onClose}>
            done
          </button>
        </div>
      </div>
    </div>
  )
}
