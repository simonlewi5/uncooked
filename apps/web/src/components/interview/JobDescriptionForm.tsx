import styles from './JobDescriptionForm.module.css'

interface JobDescriptionFormProps {
  jobDescription: string
  onJobDescriptionChange: (value: string) => void
}

export function JobDescriptionForm({
  jobDescription,
  onJobDescriptionChange,
}: JobDescriptionFormProps): React.JSX.Element {
  return (
    <div className={styles.form}>
      <p className={styles.desc}>
        Paste the job description here. The AI will generate tailored questions
        based on these requirements.
      </p>

      <textarea
        className={styles.textarea}
        placeholder="e.g. We are looking for a highly skilled engineer…"
        value={jobDescription}
        onChange={(e) => onJobDescriptionChange(e.target.value)}
      />
    </div>
  )
}
