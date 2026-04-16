import { useEffect } from 'react'
import styles from './XpToast.module.css'

interface XpToastProps {
  xp: number
  label: string
  onDone: () => void
}

export function XpToast({ xp, label, onDone }: XpToastProps): JSX.Element {
  useEffect(() => {
    const timer = setTimeout(onDone, 2000)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <div className={styles.toast}>
      <span className={styles.xp}>+{xp} XP</span>
      <span className={styles.label}>{label}</span>
    </div>
  )
}
