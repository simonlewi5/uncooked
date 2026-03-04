import type { InterviewStyle } from '@/types'
import styles from './InterviewStyleSelector.module.css'

interface InterviewStyleSelectorProps {
  value: InterviewStyle | null
  onChange: (value: InterviewStyle) => void
}

export function InterviewStyleSelector({
  value,
  onChange,
}: InterviewStyleSelectorProps): React.JSX.Element {
  return (
    <div className={styles.wrapper}>
      <label className={styles.label} htmlFor="interview-style">
        INTERVIEW STYLE
      </label>
      <select
        id="interview-style"
        className={styles.select}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value as InterviewStyle)}
      >
        <option value="" disabled>
          Select a style…
        </option>
        <option value="technical">Technical</option>
        <option value="behavioral">Behavioral</option>
        <option value="mixed">Mixed</option>
      </select>
    </div>
  )
}
