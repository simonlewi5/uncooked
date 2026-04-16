import { useState, useEffect } from 'react'
import { ArrowRight, MessageSquare, FileText, Maximize, X } from 'lucide-react'
import { CompanyAutocomplete } from './CompanyAutocomplete'
import { InterviewStyleSelector } from './InterviewStyleSelector'
import { usePastJobDescriptions } from '@/hooks/usePastJobDescriptions'
import { supabase } from '@/lib/supabase'
import type { CompanyProfile, InterviewStyle, InterviewSessionSummary } from '@/types'
import styles from './SetupForm.module.css'

type ResumeNode = { text?: string }

interface StructuredResumeData {
  name?: ResumeNode
  contact?: ResumeNode
  summary?: ResumeNode
  experience?: Array<{
    title?: ResumeNode
    company?: ResumeNode
    period?: ResumeNode
    bullets?: Array<ResumeNode>
  }>
  skills?: Array<ResumeNode>
}

interface ResumeSummary {
  id: string
  title: string
  is_primary: boolean
  updated_at: string
  structured_content: any
  source_file_path: string | null 
}

interface SetupFormProps {
  companyName: string
  onCompanyNameChange: (value: string) => void
  selectedCompanyId: string | null
  onCompanyProfileSelect: (profile: CompanyProfile) => void
  jobDescription: string
  onJobDescriptionChange: (value: string) => void
  style: InterviewStyle | null
  onStyleChange: (style: InterviewStyle) => void
  onStart: (resume?: any) => void
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
      .select('id, company_name, company_profile_id, interview_style, created_at, resume_id')
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

const handleStartInterview = () => {
    const selectedResumeObj = resumes.find(r => r.id === selectedResumeId)
    onStart(selectedResumeObj)
  }

return (
    <>
      <div className={styles.pageLayout}>
        <div className={styles.leftPanel}>
          <h3 className={styles.panelTitle}>Select Resume</h3>
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

        <div className={styles.rightPanel}>
          <div className={styles.wrapper}>
            <div className={styles.card}>
              <div className={styles.field}>
                <span className={styles.label}>Company</span>
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
        </div>
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
              {/* If you have a file URL, show an iframe/PDF. Otherwise, show the parsed text */}
              {/*{zoomedResume.source_file_path ? (
                <iframe src={zoomedResume.source_file_path} className={styles.resumeIframe} title="Resume Preview" />
              ) : (*/}
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