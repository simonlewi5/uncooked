import { Badge } from '@/components/ui'
import styles from './ResumePage.module.css'

export default function ResumePage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Resume review</h1>
        <p className={styles.subtitle}>
          Get targeted feedback on your resume aligned to the job you&apos;re applying for.
        </p>
      </div>

      <div className={styles.splitPanel}>
        <div className={styles.panel}>
          <div className={styles.panelIcon}>✏️</div>
          <p className={styles.panelTitle}>Editor</p>
          <p className={styles.panelDesc}>
            Paste or write your resume here. The AI will analyse it in real-time against the job
            description.
          </p>
          <Badge variant="info">Sprint 3</Badge>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelIcon}>💡</div>
          <p className={styles.panelTitle}>Feedback preview</p>
          <p className={styles.panelDesc}>
            Suggested improvements, missing keywords, and a match score will appear here.
          </p>
          <Badge variant="info">Sprint 3</Badge>
        </div>
      </div>
    </div>
  )
}
