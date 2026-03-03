import { useState } from 'react'
import { Button, Badge } from '@/components/ui'
import { JobDescriptionForm } from '@/components/interview/JobDescriptionForm'
import { InterviewStyleSelector } from '@/components/interview/InterviewStyleSelector'
import { ChatBox } from '@/components/interview/ChatBox'
import { useInterviewChat } from '@/hooks/useInterviewChat'
import type { JobDescriptionFormValue, InterviewStyle } from '@/types'
import styles from './InterviewPage.module.css'

type Step = 'setup' | 'interview'

const STYLE_LABEL: Record<InterviewStyle, string> = {
  technical: 'Technical',
  behavioral: 'Behavioral',
  mixed: 'Mixed',
}

function InterviewSession({
  jobData,
  style,
  onEnd,
}: {
  jobData: JobDescriptionFormValue
  style: InterviewStyle
  onEnd: () => void
}) {
  const { messages, isTyping, sendMessage } = useInterviewChat(jobData, style)

  return (
    <div className={styles.interviewLayout}>
      <div className={styles.chatCard}>
        <div className={styles.chatHeader}>
          <p className={styles.chatMeta}>
            Practicing for{' '}
            <span className={styles.chatMetaBold}>{jobData.companyName}</span>
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Badge variant="info">{STYLE_LABEL[style]}</Badge>
            <Button variant="ghost" size="sm" onClick={onEnd} className={styles.endButton}>
              End session
            </Button>
          </div>
        </div>
        <ChatBox messages={messages} isTyping={isTyping} onSend={sendMessage} />
      </div>
    </div>
  )
}

export default function InterviewPage() {
  const [step, setStep] = useState<Step>('setup')
  const [jobData, setJobData] = useState<JobDescriptionFormValue | null>(null)
  const [style, setStyle] = useState<InterviewStyle | null>(null)
  const [styleError, setStyleError] = useState(false)

  const handleJobSubmit = (value: JobDescriptionFormValue) => {
    setJobData(value)
  }

  const handleStartInterview = () => {
    if (!style) {
      setStyleError(true)
      return
    }
    setStyleError(false)
    setStep('interview')
  }

  const handleEnd = () => {
    setStep('setup')
    setJobData(null)
    setStyle(null)
  }

  if (step === 'interview' && jobData && style) {
    return (
      <div className={styles.page}>
        <InterviewSession jobData={jobData} style={style} onEnd={handleEnd} />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Interview simulator</h1>
        <p className={styles.subtitle}>
          Set up your session and practice with an AI interviewer.
        </p>
      </div>

      <div className={styles.setupCard}>
        <JobDescriptionForm onSubmit={handleJobSubmit} />

        {jobData && (
          <>
            <div className={styles.divider} />

            <InterviewStyleSelector value={style} onChange={(v) => { setStyle(v); setStyleError(false) }} />

            {styleError && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-error-text)' }}>
                Please select an interview style to continue.
              </p>
            )}

            <div className={styles.styleActions}>
              <Button onClick={handleStartInterview} size="md">
                Start interview
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
