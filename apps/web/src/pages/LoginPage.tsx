import { useState, FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import styles from './LoginPage.module.css'

export default function LoginPage() {
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)

  if (session) return <Navigate to="/dashboard" replace />

  if (confirmationSent) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.emailIcon} aria-hidden="true">✉️</div>
          <h1 className={styles.title}>Check your email</h1>
          <p className={styles.subtitle}>We sent a confirmation link to</p>
          <p className={styles.emailAddress}>{email}</p>
          <p className={styles.confirmHint}>Click the link to activate your account, then come back to sign in.</p>
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else if (data.session) {
        // confirmations disabled — session created immediately (local dev)
      } else {
        // confirmations enabled — user must verify email before signing in
        setConfirmationSent(true)
      }
    }

    setLoading(false)
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Uncooked</h1>
        <p className={styles.subtitle}>
          {mode === 'login' ? 'Sign in to your account' : 'Create an account'}
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

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" disabled={loading} className={styles.submit}>
            {loading ? 'Loading…' : mode === 'login' ? 'Sign in' : 'Sign up'}
          </button>
        </form>

        <p className={styles.toggle}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login')
              setError(null)
            }}
            className={styles.toggleBtn}
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
