import { cn } from '@/utils/cn'
import type { InterviewStyle } from '@/types'
import styles from './InterviewStyleSelector.module.css'

const STYLES: {
  value: InterviewStyle
  icon: string
  title: string
  description: string
}[] = [
  {
    value: 'technical',
    icon: '💻',
    title: 'Technical',
    description: 'Coding, system design, and role-specific technical questions.',
  },
  {
    value: 'behavioral',
    icon: '🤝',
    title: 'Behavioral',
    description: 'STAR-method questions about past experience and soft skills.',
  },
  {
    value: 'mixed',
    icon: '⚡',
    title: 'Mixed',
    description: 'A blend of technical and behavioral — closest to a real interview.',
  },
]

interface InterviewStyleSelectorProps {
  value: InterviewStyle | null
  onChange: (value: InterviewStyle) => void
}

export function InterviewStyleSelector({ value, onChange }: InterviewStyleSelectorProps) {
  return (
    <div className={styles.wrapper}>
      <div>
        <p className={styles.title}>Interview style</p>
        <p className={styles.subtitle}>Pick the type of interview you want to practice.</p>
      </div>

      <div className={styles.grid}>
        {STYLES.map((style) => (
          <button
            key={style.value}
            type="button"
            className={cn(styles.card, value === style.value && styles.cardSelected)}
            onClick={() => onChange(style.value)}
            aria-pressed={value === style.value}
          >
            <span className={styles.icon}>{style.icon}</span>
            <span className={styles.cardTitle}>{style.title}</span>
            <span className={styles.cardDesc}>{style.description}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
