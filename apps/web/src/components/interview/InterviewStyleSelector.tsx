import type { InterviewStyle } from '@/types'
import styles from './InterviewStyleSelector.module.css'

const INTERVIEW_STYLES: readonly InterviewStyle[] = ['technical', 'behavioral', 'mixed', 'friendly']

function isInterviewStyle(value: string): value is InterviewStyle {
  return (INTERVIEW_STYLES as readonly string[]).includes(value)
}

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
        onChange={(e) => {
          if (isInterviewStyle(e.target.value)) {
            onChange(e.target.value)
          }
        }}
      >
        <option value="" disabled>
          Select a style…
        </option>
        <option value="technical">Technical</option>
        <option value="behavioral">Behavioral</option>
        <option value="mixed">Mixed</option>
        <option value="friendly">Friendly &amp; Conversational</option>
      </select>
    </div>
  )
}
