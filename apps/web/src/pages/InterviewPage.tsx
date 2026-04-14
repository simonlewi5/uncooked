import { useState, useCallback } from 'react'
import { Mic, Briefcase, FileText, Building2 } from 'lucide-react'
import { JobDescriptionForm } from '@/components/interview/JobDescriptionForm'
import { InterviewStyleSelector } from '@/components/interview/InterviewStyleSelector'
import { ChatBox } from '@/components/interview/ChatBox'
import { CompanyHistory } from '@/components/interview/CompanyHistory'
import { QuestionList } from '@/components/interview/QuestionList'
import { useInterviewChat } from '@/hooks/useInterviewChat'
import { useInterviewQuestions } from '@/hooks/useInterviewQuestions'
import { extractQuestions } from '@/utils/extractQuestions'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { cn } from '@/utils/cn'
import type { ActiveTab, CompanyProfile, InterviewStyle, InterviewSessionSummary, Message } from '@/types'
import styles from './InterviewPage.module.css'

export default function InterviewPage(): JSX.Element {
  const [jobDescription, setJobDescription] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [style, setStyle] = useState<InterviewStyle | null>('mixed')
  const [activeTab, setActiveTab] = useState<ActiveTab>('jobDesc')

  // Track session ID as state so both hooks can reference it
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  const {
    questions,
    isGenerating,
    generateQuestions,
    addExtractedQuestions,
    toggleBookmark,
    updateNotes,
  } = useInterviewQuestions(activeSessionId)

  const handleAssistantMessage = useCallback(
    (msg: Message) => {
      const extracted = extractQuestions(msg.content)
      if (extracted.length > 0) {
        addExtractedQuestions(
          extracted,
          activeSessionId,
          companyName,
          selectedCompanyId,
          msg.id,
        )
      }
    },
    [addExtractedQuestions, activeSessionId, companyName, selectedCompanyId],
  )

  const { messages, isTyping, sendMessage, interviewSessionId, resumeSession, resetSession } =
    useInterviewChat(
      { jobDescription, companyName, companyContext: '' },
      style ?? 'mixed',
      handleAssistantMessage,
    )

  // Keep activeSessionId in sync with the chat hook's session id
  if (interviewSessionId !== activeSessionId) {
    setActiveSessionId(interviewSessionId)
  }

  const isChatEnabled = jobDescription.trim().length > 0 || interviewSessionId !== null

  function handleCompanyProfileSelect(profile: CompanyProfile): void {
    setCompanyName(profile.companyName)
    setSelectedCompanyId(profile.id)
    setActiveTab('jobDesc')
  }

  function handleCompanyNameChange(value: string): void {
    setCompanyName(value)
    setSelectedCompanyId(null)
  }

  const { user } = useAuth()

  async function handleCreateCompany(companyName: string): Promise<void> {
    if (!user) return
    const trimmedName = companyName.trim()
    if (!trimmedName) return

    const { data, error } = await supabase
      .from('company_profiles')
      .insert({
        user_id: user.id,
        company_name: trimmedName,
      })
      .select('id, company_name, company_website, industry, company_size')
      .single()

    if (error) {
      console.error('InterviewPage: failed to create company profile', error)
      return
    }

    if (data) {
      handleCompanyProfileSelect({
        id: data.id,
        companyName: data.company_name,
        companyWebsite: data.company_website,
        industry: data.industry,
        companySize: data.company_size,
      })
    }
  }

  function handleNewInterview(): void {
    resetSession()
    setJobDescription('')
    setCompanyName('')
    setSelectedCompanyId(null)
    setStyle('mixed')
    setActiveTab('jobDesc')
  }

  const handleLoadSession = useCallback(async (session: InterviewSessionSummary) => {
    const { data, error } = await supabase
      .from('interview_sessions')
      .select('messages, job_description, interview_style, company_name')
      .eq('id', session.id)
      .single()

    if (error || !data) {
      console.error('Failed to load interview session:', error)
      return
    }

    const loaded = (data.messages as Array<{ role: string; content: string; timestamp: string }>)
      .map((m, i) => ({
        id: `past-${i}`,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: new Date(m.timestamp),
      }))

    resumeSession(session.id, loaded)
    setCompanyName(data.company_name as string)
    if (data.job_description) setJobDescription(data.job_description as string)
    if (data.interview_style) setStyle(data.interview_style as InterviewStyle)
    setActiveTab('jobDesc')
  }, [resumeSession])

  const handleGenerateQuestions = useCallback(() => {
    generateQuestions(
      jobDescription,
      companyName,
      style ?? 'mixed',
      interviewSessionId,
      selectedCompanyId,
    )
  }, [generateQuestions, jobDescription, companyName, style, interviewSessionId, selectedCompanyId])

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Interview Simulator</h1>
          <p className={styles.subtitle}>
            Practice answering questions live with AI. Provide context to make it realistic.
          </p>
        </div>
        <div className={styles.headerActions}>
          {interviewSessionId && (
            <button
              className={styles.newSessionBtn}
              onClick={handleNewInterview}
            >
              New Interview
            </button>
          )}
          <button
            className={styles.voiceBtn}
            disabled
            aria-label="Voice mode (coming soon)"
          >
            <Mic size={16} /> Voice Mode
          </button>
        </div>
      </div>

      <div className={styles.layout}>
        <div className={styles.leftPanel}>
          <div className={styles.tabs}>
            <button
              className={cn(styles.tab, activeTab === 'jobDesc' && styles.tabActive)}
              onClick={() => setActiveTab('jobDesc')}
            >
              <Briefcase size={14} /> Job Desc
            </button>
            <button
              className={cn(styles.tab, activeTab === 'questions' && styles.tabActive)}
              onClick={() => setActiveTab('questions')}
            >
              <FileText size={14} /> Questions
            </button>
            <button
              className={cn(styles.tab, activeTab === 'companies' && styles.tabActive)}
              onClick={() => setActiveTab('companies')}
            >
              <Building2 size={14} /> Companies
            </button>
          </div>

          {activeTab === 'jobDesc' && (
            <div className={styles.tabContent}>
              <JobDescriptionForm
                companyName={companyName}
                onCompanyNameChange={handleCompanyNameChange}
                selectedCompanyId={selectedCompanyId}
                onCompanyProfileSelect={handleCompanyProfileSelect}
                onCreateCompany={handleCreateCompany}
                jobDescription={jobDescription}
                onJobDescriptionChange={setJobDescription}
              />
              <div className={styles.styleRow}>
                <InterviewStyleSelector value={style} onChange={setStyle} />
              </div>
            </div>
          )}

          {activeTab === 'questions' && (
            <div className={styles.tabContent}>
              <QuestionList
                questions={questions}
                isGenerating={isGenerating}
                onGenerate={handleGenerateQuestions}
                onToggleBookmark={toggleBookmark}
                onUpdateNotes={updateNotes}
                canGenerate={jobDescription.trim().length > 0 && companyName.trim().length > 0}
              />
            </div>
          )}

          {activeTab === 'companies' && (
            <div className={styles.tabContent}>
              <CompanyHistory
                onSelect={handleCompanyProfileSelect}
                onLoadSession={handleLoadSession}
              />
            </div>
          )}
        </div>

        <div className={styles.rightPanel}>
          <ChatBox
            messages={messages}
            isTyping={isTyping}
            onSend={sendMessage}
            disabled={!isChatEnabled}
          />
        </div>
      </div>
    </div>
  )
}
