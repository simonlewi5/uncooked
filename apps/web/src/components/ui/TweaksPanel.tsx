import { useEffect, useRef, useState } from 'react'
import { Settings2 } from 'lucide-react'
import {
  useTheme,
  type Theme,
  type Motion,
  type Density,
} from '@/contexts/ThemeContext'
import styles from './TweaksPanel.module.css'

const THEME_OPTIONS: readonly { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

const MOTION_OPTIONS: readonly { value: Motion; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'subtle', label: 'Subtle' },
  { value: 'default', label: 'Default' },
  { value: 'expressive', label: 'Expressive' },
]

const DENSITY_OPTIONS: readonly { value: Density; label: string }[] = [
  { value: 'cozy', label: 'Cozy' },
  { value: 'default', label: 'Default' },
  { value: 'compact', label: 'Compact' },
]

interface SegmentedProps<T extends string> {
  value: T
  onChange: (next: T) => void
  options: readonly { value: T; label: string }[]
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: SegmentedProps<T>): JSX.Element {
  return (
    <div className={styles.segmented} role="radiogroup">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          className={`${styles.segment} ${value === opt.value ? styles.segmentActive : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function TweaksPanel(): JSX.Element {
  const { theme, motion, density, setTheme, setMotion, setDensity } = useTheme()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handlePointer = (event: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <div className={styles.root} ref={rootRef}>
      {open && (
        <div className={styles.panel} role="dialog" aria-label="Appearance tweaks">
          <div className={styles.group}>
            <span className={styles.groupLabel}>Theme</span>
            <Segmented value={theme} onChange={setTheme} options={THEME_OPTIONS} />
          </div>
          <div className={styles.group}>
            <span className={styles.groupLabel}>Motion</span>
            <Segmented value={motion} onChange={setMotion} options={MOTION_OPTIONS} />
          </div>
          <div className={styles.group}>
            <span className={styles.groupLabel}>Density</span>
            <Segmented value={density} onChange={setDensity} options={DENSITY_OPTIONS} />
          </div>
        </div>
      )}
      <button
        type="button"
        className={styles.fab}
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Appearance tweaks"
        aria-expanded={open}
      >
        <Settings2 size={16} />
      </button>
    </div>
  )
}
