import type { MouseEvent } from 'react'
import { Link } from 'react-router-dom'

type Props = {
  /** Visible text after the arrow. Defaults to "Back". */
  label?: string
  /** Where the button navigates. Defaults to home. */
  to?: string
  /** Extra click handler (e.g. stopPropagation inside a click-to-play game). */
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void
}

/**
 * Universal exit/back control. Fixed at the top-center of the viewport on
 * every page that isn't the home grid. Same style and position everywhere.
 */
export function BackButton({ label = 'Back', to = '/', onClick }: Props) {
  return (
    <Link
      to={to}
      className="back-button"
      onClick={onClick}
      aria-label={label}
    >
      ← {label}
    </Link>
  )
}
