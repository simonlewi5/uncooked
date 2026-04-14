import { useState } from 'react'
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react'
import { CompanyLogo } from './CompanyLogo'
import { QuestionList } from './QuestionList'
import type { CompanyProfile, InterviewQuestion, InterviewStyle } from '@/types'
import styles from './InterviewSidebar.module.css'

interface InterviewSidebarProps {
  companyName: string
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
}

export function InterviewSidebar({
  companyName,
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
}: InterviewSidebarProps): React.JSX.Element {
  const [questionsOpen, setQuestionsOpen] = useState(true)
  const [jdOpen, setJdOpen] = useState(false)

  const logoProfile: CompanyProfile = companyProfile ?? {
    id: '',
    companyName,
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
              />
            </div>
          )}
        </div>

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
              <textarea
                className={styles.jdTextarea}
                value={jobDescription}
                onChange={(e) => onJobDescriptionChange(e.target.value)}
                placeholder="Paste job description here..."
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
    </div>
  )
}
