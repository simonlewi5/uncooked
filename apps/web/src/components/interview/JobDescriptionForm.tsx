import { CompanyAutocomplete } from './CompanyAutocomplete'
import { usePastJobDescriptions } from '@/hooks/usePastJobDescriptions'
import type { CompanyProfile } from '@/types'
import styles from './JobDescriptionForm.module.css'

interface JobDescriptionFormProps {
  companyName: string
  onCompanyNameChange: (value: string) => void
  selectedCompanyId: string | null
  onCompanyProfileSelect: (profile: CompanyProfile) => void
  onCreateCompany: (companyName: string) => void
  jobDescription: string
  onJobDescriptionChange: (value: string) => void
}

export function JobDescriptionForm({
  companyName,
  onCompanyNameChange,
  selectedCompanyId,
  onCompanyProfileSelect,
  onCreateCompany,
  jobDescription,
  onJobDescriptionChange,
}: JobDescriptionFormProps): React.JSX.Element {
  const { jobs } = usePastJobDescriptions(selectedCompanyId)

  return (
    <div className={styles.form}>
      <CompanyAutocomplete
        value={companyName}
        onChange={onCompanyNameChange}
        onProfileSelect={onCompanyProfileSelect}
        onCreateCompany={onCreateCompany}
      />

      {jobs.length > 0 && (
        <div className={styles.pastJobs}>
          {jobs.map((job) => (
            <button
              key={job.id}
              className={styles.pastJobBtn}
              onClick={() => onJobDescriptionChange(job.jobDescription)}
            >
              Use: {job.jobTitle}
            </button>
          ))}
        </div>
      )}

      <p className={styles.desc}>
        Paste the job description here. The AI will generate tailored questions based on these
        requirements.
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
