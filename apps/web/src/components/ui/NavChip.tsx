import type { ReactNode } from 'react'
import styles from './NavChip.module.css'

interface NavChipProps {
  icon?: ReactNode
  label: string
  pulse?: boolean
  tooltip?: string
}

export function NavChip({ icon, label, pulse = false, tooltip }: NavChipProps): JSX.Element {
  return (
    <span
      className={styles.chip}
      data-tooltip={tooltip}
      aria-label={tooltip ? `${label}. ${tooltip}` : undefined}
    >
      {icon && <span className={styles.icon}>{icon}</span>}
      {pulse && <span className={styles.pulse} aria-hidden="true" />}
      <span className={styles.label}>{label}</span>
    </span>
  )
}
