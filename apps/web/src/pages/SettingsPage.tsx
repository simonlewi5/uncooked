import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import styles from './SettingsPage.module.css'

export default function SettingsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // ── Email section ───────────────────────────────────────────────────────
  const [newEmail, setNewEmail] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailSuccess, setEmailSuccess] = useState(false)

  async function handleEmailUpdate(e: FormEvent) {
    e.preventDefault()
    setEmailError(null)
    setEmailSuccess(false)
    if (newEmail === user?.email) {
      setEmailError('That is already your current email address.')
      return
    }
    setEmailLoading(true)
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    setEmailLoading(false)
    if (error) {
      setEmailError(error.message)
    } else {
      setEmailSuccess(true)
      setNewEmail('')
    }
  }

  // ── Password section ────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)

  async function handlePasswordUpdate(e: FormEvent) {
    e.preventDefault()
    setPwError(null)
    setPwSuccess(false)
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match.')
      return
    }
    if (newPassword.length < 6) {
      setPwError('Password must be at least 6 characters.')
      return
    }
    if (!user?.email) {
      setPwError('Unable to verify your identity. Please sign in again.')
      return
    }
    setPwLoading(true)
    // Re-authenticate with current password before updating
    const { error: reAuthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })
    if (reAuthError) {
      setPwLoading(false)
      setPwError('Current password is incorrect.')
      return
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwLoading(false)
    if (error) {
      setPwError(error.message)
    } else {
      setPwSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  // ── Danger zone ─────────────────────────────────────────────────────────
  const [signOutAllLoading, setSignOutAllLoading] = useState(false)

  async function handleSignOutAll() {
    setSignOutAllLoading(true)
    await supabase.auth.signOut({ scope: 'global' })
    setSignOutAllLoading(false)
    navigate('/login')
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.subtitle}>Manage your account and security preferences</p>
      </div>

      {/* ── Email ── */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle}>Email address</h2>
          <p className={styles.sectionDesc}>
            Current: <span className={styles.currentValue}>{user?.email}</span>
          </p>
          <form onSubmit={handleEmailUpdate} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="new-email">New email address</label>
              <input
                id="new-email"
                type="email"
                className={styles.input}
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>
            {emailError && <p className={styles.errorMsg}>{emailError}</p>}
            {emailSuccess && (
              <p className={styles.successMsg}>
                Verification email sent. Check your inbox to confirm the change.
              </p>
            )}
            <div className={styles.formFooter}>
              <button type="submit" className={styles.btn} disabled={emailLoading || !newEmail}>
                {emailLoading ? 'Saving…' : 'Update email'}
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* ── Password ── */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle}>Change password</h2>
          <form onSubmit={handlePasswordUpdate} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="current-pw">Current password</label>
              <input
                id="current-pw"
                type="password"
                className={styles.input}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="new-pw">New password</label>
                <input
                  id="new-pw"
                  type="password"
                  className={styles.input}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="confirm-pw">Confirm new password</label>
                <input
                  id="confirm-pw"
                  type="password"
                  className={styles.input}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>
            {pwError && <p className={styles.errorMsg}>{pwError}</p>}
            {pwSuccess && <p className={styles.successMsg}>Password updated successfully.</p>}
            <div className={styles.formFooter}>
              <button
                type="submit"
                className={styles.btn}
                disabled={pwLoading || !currentPassword || !newPassword || !confirmPassword}
              >
                {pwLoading ? 'Saving…' : 'Update password'}
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* ── Danger zone ── */}
      <section className={styles.sectionDanger}>
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitleDanger}>Danger zone</h2>
          <div className={styles.dangerRow}>
            <div>
              <p className={styles.dangerRowLabel}>Sign out of all devices</p>
              <p className={styles.dangerRowDesc}>
                Revokes all active sessions. You will be redirected to the sign-in page.
              </p>
            </div>
            <button
              type="button"
              className={styles.btnDanger}
              onClick={handleSignOutAll}
              disabled={signOutAllLoading}
            >
              {signOutAllLoading ? 'Signing out…' : 'Sign out everywhere'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
