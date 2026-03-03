import { Badge } from '@/components/ui'
import styles from './ResearchPage.module.css'

export default function ResearchPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Company research</h1>
        <p className={styles.subtitle}>
          Get an AI-generated brief on any company before your interview.
        </p>
      </div>

      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>🔍</div>
        <p className={styles.emptyTitle}>Coming in Sprint 3</p>
        <p className={styles.emptyDesc}>
          Search any company and get an instant brief covering culture, recent news, typical
          interview questions, and what interviewers look for.
        </p>
        <div className={styles.badge}>
          <Badge variant="info">Planned</Badge>
        </div>
      </div>
    </div>
  )
}
