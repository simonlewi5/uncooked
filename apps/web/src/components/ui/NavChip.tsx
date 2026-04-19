import type { ReactNode } from 'react'
import styles from './NavChip.module.css'

interface NavChipProps {
  icon?: ReactNode
  label: string
  pulse?: boolean
  title?: string
}

export function NavChip({ icon, label, pulse = false, title }: NavChipProps): JSX.Element {
  return (
    <span className={styles.chip} title={title}>
      {icon && <span className={styles.icon}>{icon}</span>}
      {pulse && <span className={styles.pulse} aria-hidden="true" />}
      <span className={styles.label}>{label}</span>
    </span>
  )
}
