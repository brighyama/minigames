import type { CSSProperties } from 'react'
import { abbrev, betDef, colorOf, type BetMap } from './lib'

type Props = {
  bets: BetMap
  /** True while bets can still be placed. */
  open: boolean
  /** Bet ids that just won (for the result flash). Empty otherwise. */
  winningBetIds: string[]
  /** The number that just hit, or null when not in result phase. */
  winning: number | null
  onPlace: (betId: string) => void
}

// Standard felt layout. Each column c (0-based) holds 3 numbers:
//   top = 3(c+1), mid = 3(c+1)-1, bot = 3(c+1)-2
const COLS = 12

function gridPos(col: number, row: number, span = 1): CSSProperties {
  return { gridColumn: `${col} / span ${span}`, gridRow: `${row}` }
}

export function RouletteTable({
  bets,
  open,
  winningBetIds,
  winning,
  onPlace,
}: Props) {
  const won = new Set(winningBetIds)

  const cell = (
    betId: string,
    label: string,
    style: CSSProperties,
    extraClass = '',
  ) => {
    const amount = bets[betId] ?? 0
    const isWinner = won.has(betId)
    const def = betId.startsWith('s-') ? null : betDef(betId)
    return (
      <button
        key={betId}
        type="button"
        className={`rl-cell ${extraClass} ${isWinner ? 'is-winner' : ''} ${!open ? 'is-closed' : ''}`}
        style={style}
        onClick={() => open && onPlace(betId)}
        disabled={!open}
        title={def ? def.label : label}
      >
        <span className="rl-cell-label">{label}</span>
        {amount > 0 && (
          <span className="rl-cell-chip casino-chip casino-chip-mini chip-100" aria-label={`${amount} on ${label}`}>
            {abbrev(amount)}
          </span>
        )}
      </button>
    )
  }

  const numberCells = []
  // 0 spans all three rows in the first column.
  {
    const betId = 's-0'
    const amount = bets[betId] ?? 0
    const isWinner = won.has(betId)
    numberCells.push(
      <button
        key="s-0"
        type="button"
        className={`rl-cell rl-num rl-green ${isWinner ? 'is-winner' : ''} ${!open ? 'is-closed' : ''}`}
        style={{ gridColumn: '1', gridRow: '1 / span 3' }}
        onClick={() => open && onPlace(betId)}
        disabled={!open}
        title="Straight up: 0"
      >
        <span className="rl-cell-label">0</span>
        {amount > 0 && <span className="rl-cell-chip casino-chip casino-chip-mini chip-100">{abbrev(amount)}</span>}
      </button>,
    )
  }
  for (let c = 0; c < COLS; c++) {
    const top = 3 * (c + 1)
    const mid = top - 1
    const bot = top - 2
    const rows: Array<[number, number]> = [
      [top, 1],
      [mid, 2],
      [bot, 3],
    ]
    for (const [n, row] of rows) {
      const betId = `s-${n}`
      const amount = bets[betId] ?? 0
      const isWinner = won.has(betId)
      numberCells.push(
        <button
          key={betId}
          type="button"
          className={`rl-cell rl-num rl-${colorOf(n)} ${isWinner ? 'is-winner' : ''} ${!open ? 'is-closed' : ''}`}
          style={gridPos(c + 2, row)}
          onClick={() => open && onPlace(betId)}
          disabled={!open}
          title={`Straight up: ${n}`}
        >
          <span className="rl-cell-label">{n}</span>
          {amount > 0 && <span className="rl-cell-chip casino-chip casino-chip-mini chip-100">{abbrev(amount)}</span>}
        </button>,
      )
    }
  }

  return (
    <div className="rl-board" role="group" aria-label="Roulette betting board">
      {numberCells}

      {/* Column (2:1) bets at the right end of each row. */}
      {cell('c-top', '2:1', gridPos(14, 1), 'rl-outside')}
      {cell('c-mid', '2:1', gridPos(14, 2), 'rl-outside')}
      {cell('c-bot', '2:1', gridPos(14, 3), 'rl-outside')}

      {/* Dozens. */}
      {cell('d-1', '1st 12', gridPos(2, 4, 4), 'rl-outside')}
      {cell('d-2', '2nd 12', gridPos(6, 4, 4), 'rl-outside')}
      {cell('d-3', '3rd 12', gridPos(10, 4, 4), 'rl-outside')}

      {/* Even-money bets. */}
      {cell('low', '1–18', gridPos(2, 5, 2), 'rl-outside')}
      {cell('even', 'EVEN', gridPos(4, 5, 2), 'rl-outside')}
      {cell('red', '', gridPos(6, 5, 2), 'rl-outside rl-diamond-red')}
      {cell('black', '', gridPos(8, 5, 2), 'rl-outside rl-diamond-black')}
      {cell('odd', 'ODD', gridPos(10, 5, 2), 'rl-outside')}
      {cell('high', '19–36', gridPos(12, 5, 2), 'rl-outside')}

      {winning !== null && (
        <div className="rl-board-veil" aria-hidden="true" />
      )}
    </div>
  )
}
