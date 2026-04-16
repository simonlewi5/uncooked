import { useState } from 'react'
import { ArrowLeft, ChevronDown, ChevronRight, FileText, Maximize, X } from 'lucide-react'
import { CompanyLogo } from './CompanyLogo'
import { QuestionList } from './QuestionList'
import { JobDescriptionForm } from './JobDescriptionForm'
import type { CompanyProfile, InterviewQuestion, InterviewStyle } from '@/types'
import styles from './InterviewSidebar.module.css'

type ResumeNode = { text?: string }
interface StructuredResumeData {
  name?: ResumeNode
  contact?: ResumeNode
  summary?: ResumeNode
  experience?: Array<{ title?: ResumeNode; company?: ResumeNode; period?: ResumeNode; bullets?: Array<ResumeNode> }>
  skills?: Array<ResumeNode>
}

interface InterviewSidebarProps {
  companyName: string
  onCompanyNameChange: (name: string) => void
  selectedCompanyId: string | null
  onCompanyProfileSelect: (profile: CompanyProfile) => void
  companyProfile: CompanyProfile | null
  style: InterviewStyle
  jobDescription: string
  onJobDescriptionChange: (value: string) => void
  questions: InterviewQuestion[]
  isGenerating: boolean
  onGenerateQuestions: () => void
  onToggleBookmark: (id: string) => void
  onUpdateNotes: (id: string, notes: string) => void
  canGenerate: boolean
  onBack: () => void
  resume: any
  cooldownEnd: number | null
  onCooldownStart: (end: number) => void
}

function formatResumeText(parsed: StructuredResumeData | null | undefined): string {
  if (!parsed || typeof parsed !== 'object' || !parsed.name) return ''
  let text = ''
  if (parsed.name?.text) text += `${parsed.name.text}\n`
  if (parsed.contact?.text) text += `${parsed.contact.text}\n\n`
  if (parsed.summary?.text) text += `SUMMARY\n${parsed.summary.text}\n\n`
  if (parsed.experience && Array.isArray(parsed.experience)) {
    text += `EXPERIENCE\n`
    parsed.experience.forEach((job) => {
      text += `${job.title?.text || ''} at ${job.company?.text || ''} (${job.period?.text || ''})\n`
      job.bullets?.forEach((b) => { text += `• ${b.text}\n` })
      text += '\n'
    })
  }
  if (parsed.skills && Array.isArray(parsed.skills)) {
    text += `SKILLS\n${parsed.skills.map((s) => s.text).join(', ')}\n`
  }
  return text.trim()
}

export function InterviewSidebar({
  companyName,
  onCompanyNameChange,
  selectedCompanyId,
  onCompanyProfileSelect,
  companyProfile,
  style,
  jobDescription,
  onJobDescriptionChange,
  questions,
  isGenerating,
  onGenerateQuestions,
  onToggleBookmark,
  onUpdateNotes,
  canGenerate,
  onBack,
  resume,
  cooldownEnd,
  onCooldownStart,
}: InterviewSidebarProps): React.JSX.Element {
  const [questionsOpen, setQuestionsOpen] = useState(true)
  const [jdOpen, setJdOpen] = useState(false)
  const [resumeOpen, setResumeOpen] = useState(false) 
  const [zoomedResume, setZoomedResume] = useState<any | null>(null) 

  const logoProfile: CompanyProfile = companyProfile ?? {
    id: '',
    companyName: companyName,
    companyWebsite: null,
    industry: null,
    companySize: null,
  }

  return (
    <div className={styles.sidebar}>
      <div className={styles.contextHeader}>
        <CompanyLogo company={logoProfile} size="md" />
        <div className={styles.contextInfo}>
          <span className={styles.companyName}>{companyName}</span>
          <div className={styles.contextMeta}>
            <span className={styles.styleBadge}>{style}</span>
          </div>
        </div>
      </div>

      <div className={styles.accordions}>
        <div className={styles.accordion}>
          <button
            className={styles.accordionToggle}
            onClick={() => setQuestionsOpen((v) => !v)}
          >
            {questionsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Questions {questions.length > 0 && `(${questions.length})`}
          </button>
          {questionsOpen && (
            <div className={styles.questionsContent}>
              <QuestionList
                questions={questions}
                isGenerating={isGenerating}
                onGenerate={onGenerateQuestions}
                onToggleBookmark={onToggleBookmark}
                onUpdateNotes={onUpdateNotes}
                canGenerate={canGenerate}
                cooldownEnd={cooldownEnd}
                onCooldownStart={onCooldownStart}
              />
            </div>
          )}
        </div>
        {resume && (
            <div className={styles.accordion}>
              <button
                className={styles.accordionToggle}
                onClick={() => setResumeOpen((v) => !v)}
              >
                {resumeOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                Active Resume
              </button>
              {resumeOpen && (
                <div className={styles.accordionContent}>
                  <div 
                    className={styles.resumeCard}
                    onClick={() => setZoomedResume(resume)}
                  >
                    <div className={styles.resumePreviewBg}>
                      {formatResumeText(resume.structured_content) || "No resume..."}
                    </div>
                    <div className={styles.resumeCardForeground}>
                      <div className={styles.resumeCardHeader}>
                        <FileText size={16} className={styles.resumeIcon} />
                        <span className={styles.resumeTitle}>{resume.title}</span>
                        <div className={styles.cardActions}>
                          <button 
                            className={styles.zoomBtn}
                            title="View Document"
                          >
                            <Maximize size={16} />
                          </button>
                        </div>
                      </div>
                      <div className={styles.resumeCardFooter}>
                        <span className={styles.resumeDate}>
                          Updated: {new Date(resume.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
        )}
        <div className={styles.accordion}>
          <button
            className={styles.accordionToggle}
            onClick={() => setJdOpen((v) => !v)}
          >
            {jdOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Job Description
          </button>
          {jdOpen && (
            <div className={styles.accordionContent}>
              <JobDescriptionForm
                companyName={companyName}
                onCompanyNameChange={onCompanyNameChange}
                selectedCompanyId={selectedCompanyId}
                onCompanyProfileSelect={onCompanyProfileSelect}
                jobDescription={jobDescription}
                onJobDescriptionChange={onJobDescriptionChange}
              />
            </div>
          )}
        </div>
      </div>

      <div className={styles.footer}>
        <button className={styles.backBtn} onClick={onBack}>
          <ArrowLeft size={14} />
          New Interview
        </button>
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
    </div>
  )
}
