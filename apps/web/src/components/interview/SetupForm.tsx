import { useState, useEffect, useCallback } from 'react'
import { ArrowRight, MessageSquare, FileText, Maximize, X, Trash2 } from 'lucide-react'
import { CompanyAutocomplete } from './CompanyAutocomplete'
import { InterviewStyleSelector } from './InterviewStyleSelector'
import { usePastJobDescriptions } from '@/hooks/usePastJobDescriptions'
import { supabase } from '@/lib/supabase'
import type { CompanyProfile, InterviewStyle, InterviewSessionSummary, ResumeSummary, StructuredResumeData } from '@/types'
import styles from './SetupForm.module.css'



interface SetupFormProps {
  companyName: string
  onCompanyNameChange: (value: string) => void
  selectedCompanyId: string | null
  onCompanyProfileSelect: (profile: CompanyProfile) => void
  jobDescription: string
  onJobDescriptionChange: (value: string) => void
  style: InterviewStyle | null
  onStyleChange: (style: InterviewStyle) => void
  onStart: (resume?: ResumeSummary | null) => void
  onLoadSession: (session: InterviewSessionSummary) => void
  selectedResumeId: string | null
  onResumeSelect: (id: string | null) => void
}

function formatResumeText(parsed: StructuredResumeData | null | undefined): string {
  if (!parsed || typeof parsed !== 'object' || !parsed.name) {
    return ''
  }
  
  let text = ''
  
  if (parsed.name?.text) text += `${parsed.name.text}\n`
  if (parsed.contact?.text) text += `${parsed.contact.text}\n\n`
  if (parsed.summary?.text) text += `SUMMARY\n${parsed.summary.text}\n\n`
  
  if (parsed.experience && Array.isArray(parsed.experience)) {
    text += `EXPERIENCE\n`
    parsed.experience.forEach((job) => {
      text += `${job.title?.text || ''} at ${job.company?.text || ''} (${job.period?.text || ''})\n`
      job.bullets?.forEach((b) => {
        text += `• ${b.text}\n`
      })
      text += '\n'
    })
  }
  
  if (parsed.skills && Array.isArray(parsed.skills)) {
    text += `SKILLS\n${parsed.skills.map((s) => s.text).join(', ')}\n`
  }
  
  return text.trim()
}

export function SetupForm({
  companyName,
  onCompanyNameChange,
  selectedCompanyId,
  onCompanyProfileSelect,
  jobDescription,
  onJobDescriptionChange,
  style,
  onStyleChange,
  onStart,
  onLoadSession,
  selectedResumeId,
  onResumeSelect
}: SetupFormProps): React.JSX.Element {
  const { jobs } = usePastJobDescriptions(selectedCompanyId)
  const [pastSessions, setPastSessions] = useState<InterviewSessionSummary[]>([])
  const [resumes, setResumes] = useState<ResumeSummary[]>([])
  const [zoomedResume, setZoomedResume] = useState<ResumeSummary | null>(null)

  const canStart = companyName.trim().length > 0 && jobDescription.trim().length > 0

  useEffect(() => {
    supabase
      .from('interview_sessions')
      .select('id, company_name, company_profile_id, company_role_id, interview_style, created_at, resume_id')
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
            companyRoleId: (row.company_role_id as string | null) ?? null,
            roleTitle: null,
            interviewStyle: (row.interview_style as string | null) ?? null,
            createdAt: row.created_at as string,
            resumeId: (row.resume_id as string | null) ?? null,
          })),
        )
      })
    // Fetch user resumes
    supabase
      .from('resumes')
      .select('id, title, is_primary, updated_at, structured_content, source_file_path')
      .order('is_primary', { ascending: false })
      .order('updated_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to fetch resumes:', error)
          return
        }
        if (data) {
          setResumes(data)
        }
      })
  }, [])

  // 1. Keep our helper function to pass the object
  const handleStartInterview = () => {
    const selectedResumeObj = resumes.find(r => r.id === selectedResumeId)
    onStart(selectedResumeObj)
  }

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    const { error } = await supabase
      .from('interview_sessions')
      .delete()
      .eq('id', sessionId)

    if (error) {
      console.error('Failed to delete interview session:', error)
      return
    }
    setPastSessions(prev => prev.filter(s => s.id !== sessionId))
  }, [])

  return (
    <>
      <div className={styles.wrapper}>
        <div className={styles.cardContainer}>
          <div className={styles.sketchLeft} style={{ top: 64 }}>
            <span className={styles.sketchText}>1. Add the company name</span>
            <svg width="48" height="20" viewBox="0 0 48 20" fill="none">
              <path d="M2 16 C14 14, 28 10, 40 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
              <path d="M34 1 L42 4 L36 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>

          <div className={styles.sketchRight} style={{ top: 150 }}>
            <svg width="48" height="20" viewBox="0 0 48 20" fill="none">
              <path d="M46 16 C34 14, 20 10, 8 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
              <path d="M14 1 L6 4 L12 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <span className={styles.sketchText}>2. Paste the job description</span>
          </div>

          <div className={styles.sketchLeft} style={{ bottom: 150 }}>
            <span className={styles.sketchTextMulti}>
              3. Select a resume
              <br />
              <span className={styles.sketchTextSub}>(optional)</span>
            </span>
            <svg width="48" height="20" viewBox="0 0 48 20" fill="none">
              <path d="M2 16 C14 14, 28 10, 40 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
              <path d="M34 1 L42 4 L36 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>

          <div className={styles.sketchRight} style={{ bottom: 35 }}>
            <svg width="48" height="20" viewBox="0 0 48 20" fill="none">
              <path d="M46 16 C34 14, 20 10, 8 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
              <path d="M14 1 L6 4 L12 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <span className={styles.sketchTextMulti}>
              4. Pick an interview style
              <br />
              <span className={styles.sketchTextSub}>(Mixed by default)</span>
            </span>
          </div>

          <div className={styles.card}>
            <div className={styles.field}>
              <CompanyAutocomplete
                value={companyName}
                onChange={onCompanyNameChange}
                onProfileSelect={onCompanyProfileSelect}
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
              <span className={styles.label}>Resume</span>
              {resumes.length === 0 ? (
                <div className={styles.emptyState}>No resumes found. Please upload one in your settings.</div>
              ) : (
                <div className={styles.resumeList}>
                  {resumes.map((resume) => (
                    <div
                      key={resume.id}
                      className={styles.resumeCardWrapper}
                      onClick={() => onResumeSelect(selectedResumeId === resume.id ? null : resume.id)}
                    >
                      {selectedResumeId === resume.id && (
                        <>
                          <div className={styles.glowBlurLayer} />
                          <div className={styles.glowBorderLayer} />
                        </>
                      )}

                      <div className={`${styles.resumeCard} ${selectedResumeId === resume.id ? styles.resumeCardActive : ''}`}>
                        <div className={styles.resumePreviewBg}>
                          {formatResumeText(resume.structured_content) || "Experience\nEducation\nSkills\nProjects..."}
                        </div>

                        <div className={styles.resumeCardForeground}>
                          <div className={styles.resumeCardHeader}>
                            <FileText size={16} className={styles.resumeIcon} />
                            <span className={styles.resumeTitle}>{resume.title}</span>

                            <div className={styles.cardActions}>
                              <button
                                className={styles.zoomBtn}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setZoomedResume(resume);
                                }}
                                title="View Document"
                              >
                                <Maximize size={16} />
                              </button>
                            </div>
                          </div>
                          <div className={styles.resumeCardFooter}>
                            {resume.is_primary && <span className={styles.primaryBadge}>Newest</span>}
                            <span className={styles.resumeDate}>
                              Updated: {new Date(resume.updated_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.field}>
              <InterviewStyleSelector value={style} onChange={onStyleChange} />
            </div>

            <button
              className={styles.startBtn}
              disabled={!canStart}
              onClick={handleStartInterview}
            >
              Start Interview <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {pastSessions.length > 0 && (
          <div className={styles.pastSessions}>
            <span className={styles.pastSessionsTitle}>Past Sessions</span>
            <ul className={styles.sessionList}>
              {pastSessions.map((session) => (
                <li key={session.id}>
                  <div className={styles.sessionCard}>
                    <button
                      className={styles.sessionLoadBtn}
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
                    <button
                      className={styles.sessionDeleteBtn}
                      onClick={() => handleDeleteSession(session.id)}
                      title="Delete session"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {zoomedResume && (
        <div className={styles.modalOverlay} onClick={() => setZoomedResume(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{zoomedResume.title}</h3>
              <button className={styles.closeBtn} onClick={() => setZoomedResume(null)}>
                <X size={20} />
              </button>
            </div>
            
            <div className={styles.modalBody}>
                <div className={styles.resumeTextPreview}>
                  {formatResumeText(zoomedResume.structured_content) || "No text content available for this resume."}
                </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}