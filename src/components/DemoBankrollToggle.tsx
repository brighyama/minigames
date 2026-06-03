type Props = {
  enabled: boolean
  disabled?: boolean
  onChange: (enabled: boolean) => void
}

export function DemoBankrollToggle({ enabled, disabled = false, onChange }: Props) {
  return (
    <button
      type="button"
      className={`demo-bankroll-toggle ${enabled ? 'is-on' : ''}`}
      onClick={() => onChange(!enabled)}
      disabled={disabled}
      aria-pressed={enabled}
    >
      <span>demo bankroll</span>
      <strong>{enabled ? '250 on' : 'off'}</strong>
    </button>
  )
}
