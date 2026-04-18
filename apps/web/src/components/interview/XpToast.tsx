import { useEffect, type CSSProperties } from 'react'
import { cn } from '@/utils/cn'
import styles from './XpToast.module.css'

interface XpToastProps {
  /** When `achievement`, shows badge unlock copy instead of +XP. */
  variant?: 'xp' | 'achievement'
  xp?: number
  label: string
  /** e.g. vertical offset when stacking multiple toasts */
  style?: CSSProperties
  onDone: () => void
}

export function XpToast({ variant = 'xp', xp = 0, label, style, onDone }: XpToastProps): JSX.Element {
  useEffect(() => {
    const timer = setTimeout(onDone, variant === 'achievement' ? 2600 : 2000)
    return () => clearTimeout(timer)
  }, [onDone, variant])

  if (variant === 'achievement') {
    return (
      <div className={cn(styles.toast, styles.toastAchievement)} style={style}>
        <span className={styles.achievementKicker}>Achievement unlocked</span>
        <span className={styles.label}>{label}</span>
      </div>
    )
  }

  return (
    <div className={styles.toast} style={style}>
      <span className={styles.xp}>+{xp} XP</span>
      <span className={styles.label}>{label}</span>
    </div>
  )
}
