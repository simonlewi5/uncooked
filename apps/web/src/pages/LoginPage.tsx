import { useState, FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import styles from './LoginPage.module.css'

type Mode = 'login' | 'signup' | 'forgot'

export default function LoginPage() {
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<Mode>('login')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  if (session) return <Navigate to="/dashboard" replace />

  if (confirmationSent) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.emailIcon} aria-hidden="true">✉️</div>
          <h1 className={styles.title}>Check your email</h1>
          <p className={styles.subtitle}>We sent a confirmation link to</p>
          <p className={styles.emailAddress}>{email}</p>
          <p className={styles.confirmHint}>
            Click the link to activate your account, then come back to sign in.
          </p>
          <button
            type="button"
            className={styles.ghostButton}
            onClick={() => {
              setConfirmationSent(false)
              setMode('login')
              setPassword('')
            }}
          >
            ← Back to sign in
          </button>
        </div>
      </div>
    )
  }

  if (resetSent) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.emailIcon} aria-hidden="true">🔑</div>
          <h1 className={styles.title}>Check your email</h1>
          <p className={styles.subtitle}>We sent a password reset link to</p>
          <p className={styles.emailAddress}>{email}</p>
          <p className={styles.confirmHint}>
            Click the link to choose a new password. It expires in 1 hour.
          </p>
          <button
            type="button"
            className={styles.ghostButton}
            onClick={() => {
              setResetSent(false)
              setMode('login')
            }}
          >
            ← Back to sign in
          </button>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else if (data.session) {
        // confirmations disabled — session created immediately (local dev)
      } else {
        setConfirmationSent(true)
      }
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      })
      if (error) {
        setError(error.message)
      } else {
        setResetSent(true)
      }
    }

    setLoading(false)
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Uncooked</h1>
        <p className={styles.subtitle}>
          {mode === 'login' && 'Sign in to your account'}
          {mode === 'signup' && 'Create an account'}
          {mode === 'forgot' && 'Reset your password'}
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className={styles.input}
            />
          </label>

          {mode !== 'forgot' && (
            <label className={styles.label}>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className={styles.input}
              />
            </label>
          )}

          {mode === 'login' && (
            <button
              type="button"
              className={styles.forgotLink}
              onClick={() => switchMode('forgot')}
            >
              Forgot password?
            </button>
          )}

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" disabled={loading} className={styles.submit}>
            {loading
              ? 'Loading…'
              : mode === 'login'
                ? 'Sign in'
                : mode === 'signup'
                  ? 'Sign up'
                  : 'Send reset link'}
          </button>
        </form>

        {mode !== 'forgot' ? (
          <p className={styles.toggle}>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
              className={styles.toggleBtn}
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        ) : (
          <p className={styles.toggle}>
            <button type="button" onClick={() => switchMode('login')} className={styles.toggleBtn}>
              ← Back to sign in
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
