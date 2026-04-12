import { useState, useCallback } from 'react'
import { Mic, Briefcase, FileText, Building2 } from 'lucide-react'
import { JobDescriptionForm } from '@/components/interview/JobDescriptionForm'
import { InterviewStyleSelector } from '@/components/interview/InterviewStyleSelector'
import { ChatBox } from '@/components/interview/ChatBox'
import { CompanyHistory } from '@/components/interview/CompanyHistory'
import { useInterviewChat } from '@/hooks/useInterviewChat'
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
  const [pastMessages, setPastMessages] = useState<Message[] | null>(null)

  const { messages, isTyping, sendMessage } = useInterviewChat(
    { jobDescription, companyName, companyContext: '' },
    style ?? 'mixed',
  )

  const isChatEnabled = jobDescription.trim().length > 0

  function handleCompanyProfileSelect(profile: CompanyProfile): void {
    setCompanyName(profile.companyName)
    setSelectedCompanyId(profile.id)
    setPastMessages(null)
    setActiveTab('jobDesc')
  }

  function handleCompanyNameChange(value: string): void {
    setCompanyName(value)
    setSelectedCompanyId(null)
    setPastMessages(null)
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

    setPastMessages(loaded)
    setCompanyName(data.company_name as string)
    if (data.job_description) setJobDescription(data.job_description as string)
    if (data.interview_style) setStyle(data.interview_style as InterviewStyle)
    setActiveTab('jobDesc')
  }, [])

  const displayMessages = pastMessages ?? messages
  const isViewingPast = pastMessages !== null

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
          {isViewingPast && (
            <button
              className={styles.newSessionBtn}
              onClick={() => setPastMessages(null)}
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
                jobDescription={jobDescription}
                onJobDescriptionChange={setJobDescription}
              />
              <div className={styles.styleRow}>
                <InterviewStyleSelector value={style} onChange={setStyle} />
              </div>
            </div>
          )}

          {activeTab === 'questions' && (
            <div className={styles.emptyTab}>
              <FileText size={24} className={styles.emptyIcon} />
              <p className={styles.emptyText}>
                Questions will appear here once AI generates them.
              </p>
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
            messages={displayMessages}
            isTyping={!isViewingPast && isTyping}
            onSend={sendMessage}
            disabled={isViewingPast || !isChatEnabled}
          />
        </div>
      </div>
    </div>
  )
}
