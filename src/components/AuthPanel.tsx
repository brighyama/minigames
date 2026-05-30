import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { fetchProfile, saveProfile } from '../lib/profile'
import { supabase } from '../lib/supabase'

export function AuthPanel() {
  const { user, loading, configured } = useAuth()

  if (!configured) {
    return (
      <div className="auth-empty">
        <p>
          sign-in is not configured yet. add your Supabase keys to{' '}
          <code>.env.local</code> and restart the dev server.
        </p>
      </div>
    )
  }

  if (loading) {
    return <div className="auth-empty">loading…</div>
  }

  return user ? <SignedIn /> : <SignedOut />
}

/* -------------------------------------------------------------------------- */
/* Signed-out: sign in or create account                                      */
/* -------------------------------------------------------------------------- */

function SignedOut() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)
    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password)
        if (error) setError(error)
      } else {
        const { error } = await signUp(email, password)
        if (error) setError(error)
        else setInfo('account created. check your inbox to confirm.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <div className="auth-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signin'}
          className={`auth-tab ${mode === 'signin' ? 'is-active' : ''}`}
          onClick={() => setMode('signin')}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signup'}
          className={`auth-tab ${mode === 'signup' ? 'is-active' : ''}`}
          onClick={() => setMode('signup')}
        >
          Create
        </button>
      </div>

      <label className="auth-field">
        <span>Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>

      <label className="auth-field">
        <span>Password</span>
        <input
          type="password"
          required
          minLength={6}
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      {error && <div className="auth-error">{error}</div>}
      {info && <div className="auth-info">{info}</div>}

      <button type="submit" className="auth-button" disabled={submitting}>
        {submitting
          ? 'Working…'
          : mode === 'signin'
            ? 'Sign in'
            : 'Create account'}
      </button>
    </form>
  )
}

/* -------------------------------------------------------------------------- */
/* Signed-in: profile + account management                                    */
/* -------------------------------------------------------------------------- */

function SignedIn() {
  const { user, signOut } = useAuth()

  return (
    <div className="auth-account">
      <div className="auth-account-row">
        <span className="auth-label">Signed in as</span>
        <span className="auth-email" title={user?.email ?? ''}>
          {user?.email}
        </span>
      </div>

      <UsernameForm />
      <PasswordForm />

      <button
        type="button"
        className="auth-button auth-button-secondary"
        onClick={() => signOut()}
      >
        Sign out
      </button>
    </div>
  )
}

function UsernameForm() {
  const { user } = useAuth()
  const [username, setUsername] = useState('')
  const [initial, setInitial] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetchProfile(user.id).then((profile) => {
      if (cancelled || !profile) return
      const current = profile.username ?? ''
      setUsername(current)
      setInitial(current)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    const trimmed = username.trim()
    if (trimmed === initial) return
    setError(null)
    setInfo(null)
    setSubmitting(true)
    const { error } = await saveProfile(user.id, { username: trimmed || null })
    setSubmitting(false)
    if (error) {
      setError(
        error.includes('duplicate') || error.includes('unique')
          ? 'that username is already taken.'
          : error,
      )
    } else {
      setInitial(trimmed)
      setInfo('saved.')
    }
  }

  const dirty = username.trim() !== initial

  return (
    <form className="auth-subform" onSubmit={onSubmit}>
      <label className="auth-field">
        <span>Username</span>
        <input
          type="text"
          maxLength={32}
          placeholder="Choose a display name"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value)
            setInfo(null)
            setError(null)
          }}
        />
      </label>
      {error && <div className="auth-error">{error}</div>}
      {info && <div className="auth-info">{info}</div>}
      <button
        type="submit"
        className="auth-button auth-button-secondary"
        disabled={!dirty || submitting}
      >
        {submitting ? 'Saving…' : 'Save username'}
      </button>
    </form>
  )
}

function PasswordForm() {
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (next.length < 6) {
      setError('password must be at least 6 characters.')
      return
    }
    if (next !== confirm) {
      setError('passwords do not match.')
      return
    }
    if (!supabase) {
      setError('auth is not configured.')
      return
    }
    setSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password: next })
    setSubmitting(false)
    if (error) {
      setError(error.message)
    } else {
      setNext('')
      setConfirm('')
      setInfo('password updated.')
    }
  }

  return (
    <form className="auth-subform" onSubmit={onSubmit}>
      <label className="auth-field">
        <span>New password</span>
        <input
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => {
            setNext(e.target.value)
            setInfo(null)
            setError(null)
          }}
        />
      </label>
      <label className="auth-field">
        <span>Confirm</span>
        <input
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value)
            setInfo(null)
            setError(null)
          }}
        />
      </label>
      {error && <div className="auth-error">{error}</div>}
      {info && <div className="auth-info">{info}</div>}
      <button
        type="submit"
        className="auth-button auth-button-secondary"
        disabled={submitting || !next || !confirm}
      >
        {submitting ? 'Updating…' : 'Change password'}
      </button>
    </form>
  )
}
