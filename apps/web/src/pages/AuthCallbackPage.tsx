import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Spinner } from '@/components/ui'
import styles from './AuthCallbackPage.module.css'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')

    if (!code) {
      navigate('/login', { replace: true })
      return
    }

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setError(error.message)
      } else {
        navigate('/dashboard', { replace: true })
      }
    })
  }, [navigate])

  if (error) {
    return (
      <div className={styles.page}>
        <p className={styles.error}>Confirmation failed: {error}</p>
        <a href="/login" className={styles.link}>
          Back to sign in
        </a>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <Spinner size="md" />
      <p className={styles.message}>Confirming your email…</p>
    </div>
  )
}
