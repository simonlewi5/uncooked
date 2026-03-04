import { useState } from 'react'
import { Mic, Briefcase, FileText } from 'lucide-react'
import { JobDescriptionForm } from '@/components/interview/JobDescriptionForm'
import { InterviewStyleSelector } from '@/components/interview/InterviewStyleSelector'
import { ChatBox } from '@/components/interview/ChatBox'
import { useInterviewChat } from '@/hooks/useInterviewChat'
import { cn } from '@/utils/cn'
import type { ActiveTab, InterviewStyle } from '@/types'
import styles from './InterviewPage.module.css'

export default function InterviewPage(): JSX.Element {
  const [jobDescription, setJobDescription] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [style, setStyle] = useState<InterviewStyle | null>(null)
  const [activeTab, setActiveTab] = useState<ActiveTab>('jobDesc')

  // companyName and companyContext wired up in #20/#21
  const { messages, isTyping, sendMessage } = useInterviewChat(
    { jobDescription, companyName, companyContext: '' },
    style ?? 'mixed',
  )

  const isChatEnabled = jobDescription.trim().length > 0

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Interview Simulator</h1>
          <p className={styles.subtitle}>
            Practice answering questions live with AI. Provide context to make
            it realistic.
          </p>
        </div>
        <button
          className={styles.voiceBtn}
          disabled
          aria-label="Voice mode (coming soon)"
        >
          <Mic size={16} /> Voice Mode
        </button>
      </div>

      <div className={styles.layout}>
        <div className={styles.leftPanel}>
          <div className={styles.tabs}>
            <button
              className={cn(
                styles.tab,
                activeTab === 'jobDesc' && styles.tabActive,
              )}
              onClick={() => setActiveTab('jobDesc')}
            >
              <Briefcase size={14} /> Job Desc
            </button>
            <button
              className={cn(
                styles.tab,
                activeTab === 'questions' && styles.tabActive,
              )}
              onClick={() => setActiveTab('questions')}
            >
              <FileText size={14} /> Questions
            </button>
          </div>

          {activeTab === 'jobDesc' ? (
            <div className={styles.tabContent}>
              <JobDescriptionForm
                companyName={companyName}
                onCompanyNameChange={setCompanyName}
                jobDescription={jobDescription}
                onJobDescriptionChange={setJobDescription}
              />
              <div className={styles.styleRow}>
                <InterviewStyleSelector value={style} onChange={setStyle} />
              </div>
            </div>
          ) : (
            <div className={styles.emptyTab}>
              <FileText size={24} className={styles.emptyIcon} />
              <p className={styles.emptyText}>
                Questions will appear here once AI generates them.
              </p>
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
