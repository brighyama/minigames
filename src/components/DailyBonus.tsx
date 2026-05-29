import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { fetchProfile } from '../lib/profile'

const COOLDOWN_MS = 24 * 60 * 60 * 1000

type ClaimRow = {
  claimed: boolean
  next_at: string | null
  awarded: number
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

export function DailyBonus() {
  const { user } = useAuth()
  const toast = useToast()
  const [nextAt, setNextAt] = useState<Date | null>(null)
  const [now, setNow] = useState(Date.now())
  const [busy, setBusy] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Pull last_daily_claim from the profile so the cooldown survives refresh
  // and is consistent across devices.
  useEffect(() => {
    if (!user) {
      setNextAt(null)
      setHydrated(false)
      return
    }
    let cancelled = false
    fetchProfile(user.id).then((profile) => {
      if (cancelled) return
      if (profile?.last_daily_claim) {
        const next = new Date(
          new Date(profile.last_daily_claim).getTime() + COOLDOWN_MS,
        )
        setNextAt(next.getTime() > Date.now() ? next : null)
      } else {
        setNextAt(null)
      }
      setHydrated(true)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  // Tick once a second so the countdown updates live.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  if (!user || !hydrated) return null

  const available = nextAt === null || nextAt.getTime() <= now

  const claim = async () => {
    if (!supabase) return
    setBusy(true)
    const { data, error } = await supabase.rpc('claim_daily_points')
    setBusy(false)

    if (error) {
      toast.show(error.message, { tone: 'error' })
      return
    }

    const row: ClaimRow | undefined = Array.isArray(data) ? data[0] : undefined
    if (!row) {
      toast.show('Unexpected response from server.', { tone: 'error' })
      return
    }

    if (row.claimed) {
      toast.show(`+${row.awarded} daily bonus`, { tone: 'success' })
      window.dispatchEvent(new CustomEvent('points-changed'))
      if (row.next_at) setNextAt(new Date(row.next_at))
    } else {
      // Server says still on cooldown — sync our timer to match.
      if (row.next_at) setNextAt(new Date(row.next_at))
      toast.show('Already claimed today.', { tone: 'info' })
    }
  }

  if (available) {
    return (
      <button
        type="button"
        className="daily-bonus is-available"
        onClick={claim}
        disabled={busy}
        aria-label="Claim daily bonus"
        title="Free 100 points — once every 24 hours"
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="8" width="18" height="4" />
          <rect x="5" y="12" width="14" height="9" />
          <path d="M12 8v13" />
          <path d="M12 8s-2-3-4-3a2.5 2.5 0 0 0 0 5h4" />
          <path d="M12 8s2-3 4-3a2.5 2.5 0 0 1 0 5h-4" />
        </svg>
        <span className="daily-bonus-text">+100</span>
      </button>
    )
  }

  return (
    <div
      className="daily-bonus is-cooldown"
      aria-label="Daily bonus on cooldown"
      title="Daily bonus available again soon"
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
      <span className="daily-bonus-text">
        {formatCountdown(nextAt!.getTime() - now)}
      </span>
    </div>
  )
}
