import styles from './XpBar.module.css'

interface XpBarProps {
  value: number
  max: number
  animated?: boolean
}

export function XpBar({ value, max, animated = true }: XpBarProps): JSX.Element {
  const safeMax = max > 0 ? max : 1
  const pct = Math.max(0, Math.min(100, (value / safeMax) * 100))
  return (
    <div className={styles.track}>
      <div className={styles.fill} style={{ width: `${pct}%` }}>
        {animated && <span className={styles.sheen} aria-hidden="true" />}
      </div>
    </div>
  )
}
