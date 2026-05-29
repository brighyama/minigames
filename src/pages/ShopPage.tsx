import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { themes, type Theme } from '../lib/themes'
import { RarityIcon, rarityLabel } from '../components/RarityIcon'

type Props = {
  unlocks: string[]
  points: number | null
  onUnlock: (themeId: string) => void
}

export function ShopPage({ unlocks, points, onUnlock }: Props) {
  const { user } = useAuth()
  const toast = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)

  const lockedThemes = themes.filter((t) => t.locked)

  const purchase = async (theme: Theme) => {
    if (!supabase) {
      toast.show('Auth is not configured.', { tone: 'error' })
      return
    }
    if (!user) {
      toast.show('Sign in to make purchases.', { tone: 'error' })
      return
    }
    const cost = theme.cost ?? 0
    if (cost <= 0) return

    setBusyId(theme.id)
    const { data: success, error } = await supabase.rpc('spend_points', { amount: cost })
    setBusyId(null)

    if (error) {
      toast.show(error.message, { tone: 'error' })
      return
    }
    if (!success) {
      toast.show('Not enough points.', { tone: 'error' })
      return
    }
    onUnlock(theme.id)
    window.dispatchEvent(new CustomEvent('points-changed'))
    toast.show(`Unlocked: ${theme.name}`, { tone: 'success' })
  }

  return (
    <main className="container">
      <header className="hero hero-compact">
        <Link to="/" className="back-link">← Back</Link>
        <h1 className="title title-md">Shop</h1>
        <p className="subtitle">Spend points to unlock cosmetics and collectibles.</p>
      </header>

      <section className="shop-section" aria-labelledby="shop-themes-heading">
        <header className="shop-section-header">
          <h2 id="shop-themes-heading" className="shop-section-title">Themes</h2>
          <span className="shop-section-meta">
            {lockedThemes.length} available
          </span>
        </header>

        <div className="shop-grid">
          {lockedThemes.map((theme) => {
            const owned = unlocks.includes(theme.id)
            const cost = theme.cost ?? 0
            const canAfford = points !== null && points >= cost
            const busy = busyId === theme.id
            const rarityClass = theme.rarity ? `rarity-${theme.rarity}` : ''

            return (
              <article
                key={theme.id}
                className={`shop-card ${rarityClass}`}
              >
                <div
                  className="shop-card-preview"
                  style={{
                    background: `linear-gradient(135deg, ${theme.start}, ${theme.stop})`,
                  }}
                  aria-hidden="true"
                />
                <div className="shop-card-body">
                  <div className="shop-card-head">
                    <h3 className="shop-card-name">{theme.name}</h3>
                    <div className="shop-card-tags">
                      {theme.rarity && (
                        <span
                          className={`shop-card-rarity rarity-${theme.rarity}`}
                          aria-label={rarityLabel(theme.rarity)}
                          title={rarityLabel(theme.rarity)}
                        >
                          <RarityIcon rarity={theme.rarity} />
                        </span>
                      )}
                      {owned ? (
                        <span className="shop-card-tag shop-card-owned">Owned</span>
                      ) : (
                        <span className="shop-card-tag">{cost} pts</span>
                      )}
                    </div>
                  </div>

                  {!owned && (
                    <button
                      type="button"
                      className="shop-card-button"
                      onClick={() => purchase(theme)}
                      disabled={busy || !canAfford || !user}
                    >
                      {busy
                        ? 'Buying…'
                        : !user
                          ? 'Sign in to buy'
                          : !canAfford
                            ? 'Not enough points'
                            : `Buy for ${cost}`}
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </main>
  )
}
