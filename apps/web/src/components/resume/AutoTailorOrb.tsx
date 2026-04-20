import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import styles from './AutoTailorOrb.module.css'

interface AutoTailorOrbProps {
  active: boolean
}

type StepState = 'done' | 'active' | 'pending'

const STEPS = [
  'Parsing job description',
  'Matching against your resume',
  'Drafting targeted bullets',
  'Scoring keyword overlap',
  'Ready to review',
] as const

const STEP_INTERVAL_MS = 900

export function AutoTailorOrb({ active }: AutoTailorOrbProps): JSX.Element | null {
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    if (!active) {
      setStepIndex(0)
      return
    }
    const id = window.setInterval(() => {
      setStepIndex((prev) => (prev < STEPS.length - 1 ? prev + 1 : prev))
    }, STEP_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [active])

  if (!active) return null

  return (
    <div className={styles.root} role="status" aria-live="polite">
      <div className={styles.orb} aria-hidden="true" />
      <h3 className={styles.title}>Auto-tailoring your resume</h3>
      <p className={styles.subtitle}>
        Analyzing the job description and your experience. This usually takes a few seconds.
      </p>
      <ul className={styles.steps}>
        {STEPS.map((label, i) => {
          const state: StepState = i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'pending'
          const stepStateClass =
            state === 'done' ? styles.stepDone : state === 'active' ? styles.stepActive : styles.stepPending
          return (
            <li key={label} className={`${styles.step} ${stepStateClass}`}>
              <span className={styles.stepMarker} aria-hidden="true">
                {state === 'done' && <Check size={10} strokeWidth={2.5} />}
                {state === 'active' && <span className={styles.pulse} />}
              </span>
              <span className={styles.stepLabel}>{label}</span>
              <span className={styles.stepStatus}>
                {state === 'done' ? 'done' : state === 'active' ? 'working…' : ''}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
