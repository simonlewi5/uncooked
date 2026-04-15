import { useState, useEffect } from 'react'
import { ArrowRight, MessageSquare } from 'lucide-react'
import { CompanyAutocomplete } from './CompanyAutocomplete'
import { InterviewStyleSelector } from './InterviewStyleSelector'
import { usePastJobDescriptions } from '@/hooks/usePastJobDescriptions'
import { supabase } from '@/lib/supabase'
import type { CompanyProfile, InterviewStyle, InterviewSessionSummary } from '@/types'
import styles from './SetupForm.module.css'

interface SetupFormProps {
  companyName: string
  onCreateCompany: (name: string) => void
  onCompanyNameChange: (value: string) => void
  selectedCompanyId: string | null
  onCompanyProfileSelect: (profile: CompanyProfile) => void
  jobDescription: string
  onJobDescriptionChange: (value: string) => void
  style: InterviewStyle | null
  onStyleChange: (style: InterviewStyle) => void
  onStart: () => void
  onLoadSession: (session: InterviewSessionSummary) => void
}

export function SetupForm({
  companyName,
  onCreateCompany,
  onCompanyNameChange,
  selectedCompanyId,
  onCompanyProfileSelect,
  jobDescription,
  onJobDescriptionChange,
  style,
  onStyleChange,
  onStart,
  onLoadSession,
}: SetupFormProps): React.JSX.Element {
  const { jobs } = usePastJobDescriptions(selectedCompanyId)
  const [pastSessions, setPastSessions] = useState<InterviewSessionSummary[]>([])

  const canStart = companyName.trim().length > 0 && jobDescription.trim().length > 0

  useEffect(() => {
    supabase
      .from('interview_sessions')
      .select('id, company_name, company_profile_id, interview_style, created_at')
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to fetch past sessions:', error)
          return
        }
        setPastSessions(
          (data ?? []).map((row) => ({
            id: row.id as string,
            companyName: row.company_name as string,
            companyProfileId: (row.company_profile_id as string | null) ?? null,
            interviewStyle: (row.interview_style as string | null) ?? null,
            createdAt: row.created_at as string,
          })),
        )
      })
  }, [])

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.field}>
          <span className={styles.label}>Company</span>
          <CompanyAutocomplete
            value={companyName}
            onChange={onCompanyNameChange}
            onProfileSelect={onCompanyProfileSelect}
            onCreateCompany={onCreateCompany}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Job Description</span>
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
          <textarea
            className={styles.textarea}
            placeholder="Paste the job description here. The AI will generate tailored questions based on these requirements."
            value={jobDescription}
            onChange={(e) => onJobDescriptionChange(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <InterviewStyleSelector value={style} onChange={onStyleChange} />
        </div>

        <button
          className={styles.startBtn}
          disabled={!canStart}
          onClick={onStart}
        >
          Start Interview <ArrowRight size={16} />
        </button>
      </div>

      {pastSessions.length > 0 && (
        <div className={styles.pastSessions}>
          <span className={styles.pastSessionsTitle}>Past Sessions</span>
          <ul className={styles.sessionList}>
            {pastSessions.map((session) => (
              <li key={session.id}>
                <button
                  className={styles.sessionCard}
                  onClick={() => onLoadSession(session)}
                >
                  <MessageSquare size={16} className={styles.sessionIcon} />
                  <div className={styles.sessionInfo}>
                    <span className={styles.sessionCompany}>{session.companyName}</span>
                    <span className={styles.sessionMeta}>
                      {session.interviewStyle ? `${session.interviewStyle} · ` : ''}
                      {new Date(session.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
