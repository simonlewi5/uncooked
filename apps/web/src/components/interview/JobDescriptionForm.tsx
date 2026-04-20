import { CompanyLogo } from './CompanyLogo'
import { usePastJobDescriptions } from '@/hooks/usePastJobDescriptions'
import type { CompanyProfile } from '@/types'
import styles from './JobDescriptionForm.module.css'

interface JobDescriptionFormProps {
  companyName: string
  selectedCompanyId: string | null
  companyProfile: CompanyProfile | null
  companyWebsite?: string | null
  roleTitle?: string | null
  jobDescription: string
  onJobDescriptionChange: (value: string) => void
}

export function JobDescriptionForm({
  companyName,
  selectedCompanyId,
  companyProfile,
  companyWebsite,
  roleTitle,
  jobDescription,
  onJobDescriptionChange,
}: JobDescriptionFormProps): React.JSX.Element {
  const { jobs } = usePastJobDescriptions(selectedCompanyId)

  const logoProfile: CompanyProfile = {
    id: companyProfile?.id || selectedCompanyId || '',
    companyName: companyProfile?.companyName || companyName || 'Company',
    companyWebsite: companyWebsite || companyProfile?.companyWebsite || null,
    industry: companyProfile?.industry || null,
    companySize: companyProfile?.companySize || null,
  }

  return (
    <div className={styles.form}>
      <div className={styles.chipRow}>
        <span className={styles.companyChip}>
          <CompanyLogo company={logoProfile} size="sm" />
          <span className={styles.companyChipText}>{companyName || 'Company'}</span>
        </span>
        {roleTitle && (
          <span className={styles.roleChip}>
            <span className={styles.roleChipLabel}>Role:</span>
            <span className={styles.roleChipValue}>{roleTitle}</span>
          </span>
        )}
      </div>

      <p className={styles.helper}>
        Tailored questions generated from these requirements. Update or replace the JD to refine
        future questions.
      </p>

      {jobs.length > 0 && (
        <div className={styles.pastJobs}>
          {jobs.map((job) => (
            <button
              key={job.id}
              type="button"
              className={styles.pastJobBtn}
              onClick={() => onJobDescriptionChange(job.jobDescription)}
            >
              Use: {job.jobTitle}
            </button>
          ))}
        </div>
      )}

      <div className={styles.jdBox}>
        <textarea
          className={styles.textarea}
          placeholder="Paste the job description here…"
          value={jobDescription}
          onChange={(e) => onJobDescriptionChange(e.target.value)}
        />
      </div>
    </div>
  )
}
