import { Input } from '@/components/ui'
import styles from './JobDescriptionForm.module.css'

interface JobDescriptionFormProps {
  companyName: string
  onCompanyNameChange: (value: string) => void
  jobDescription: string
  onJobDescriptionChange: (value: string) => void
}

export function JobDescriptionForm({
  companyName,
  onCompanyNameChange,
  jobDescription,
  onJobDescriptionChange,
}: JobDescriptionFormProps): React.JSX.Element {
  return (
    <div className={styles.form}>
      <Input
        label="Company name"
        placeholder="e.g. Acme Corp"
        value={companyName}
        onChange={(e) => onCompanyNameChange(e.target.value)}
      />

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
