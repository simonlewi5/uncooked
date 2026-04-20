import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { getJobApplications, createJobApplication } from '@/lib/jobApplications'
import styles from './JobApplicationSidebar.module.css'

type JobApplication = {
  id: string
  job_title: string
  resume_id: string | null
  status: string
  company_profiles: { company_name: string } | null
}

type Props = {
  userId: string
  activeResumeId: string | null
  onSelect: (resumeId: string, jobApplicationId: string, jobDescription: string) => void
}

export function JobApplicationSidebar({ userId, activeResumeId, onSelect }: Props) {
  const [jobs, setJobs] = useState<JobApplication[]>([])
  const [showForm, setShowForm] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    getJobApplications(userId).then(setJobs).catch(console.error)
  }, [userId])

  async function handleCreate() {
    if (!companyName.trim() || !jobTitle.trim()) return
    setIsCreating(true)
    setError(null)
    try {
      const { app, resumeId } = await createJobApplication(userId, {
        company_name: companyName.trim(),
        job_title: jobTitle.trim(),
        job_description: '',
      })
      const newJob = {
        ...app,
        company_profiles: { company_name: companyName.trim() },
      }
      setJobs((prev) => [newJob, ...prev])
      onSelect(resumeId, app.id, '')
      setShowForm(false)
      setCompanyName('')
      setJobTitle('')
    } catch {
      setError('Failed to create application.')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
        <span className={styles.title}>Applications</span>
        <button className={styles.addBtn} onClick={() => setShowForm((v) => !v)}>
          <Plus size={14} />
        </button>
      </div>

      {showForm && (
        <div className={styles.form}>
          <input
            className={styles.input}
            placeholder="Company name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
          <input
            className={styles.input}
            placeholder="Job title"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
          />
          {error && <p className={styles.error}>{error}</p>}
          <button className={styles.createBtn} onClick={handleCreate} disabled={isCreating}>
            {isCreating ? 'Creating...' : 'Create'}
          </button>
        </div>
      )}

      <div className={styles.list}>
        {jobs.length === 0 && (
          <p className={styles.empty}>No applications yet. Add one above.</p>
        )}
        {jobs.map((job) => (
          <div
            key={job.id}
            className={`${styles.item} ${job.resume_id === activeResumeId ? styles.active : ''}`}
            onClick={() => {
              if (job.resume_id) {
                onSelect(job.resume_id, job.id, '')
              }
            }}
          >
            <div className={styles.company}>
              {job.company_profiles?.company_name ?? 'Unknown company'}
            </div>
            <div className={styles.jobTitle}>{job.job_title}</div>
          </div>
        ))}
      </div>
    </div>
  )
}