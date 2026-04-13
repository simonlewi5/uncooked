import { useState } from 'react'
import { Mic, Briefcase, FileText, Building2 } from 'lucide-react'
import { JobDescriptionForm } from '@/components/interview/JobDescriptionForm'
import { InterviewStyleSelector } from '@/components/interview/InterviewStyleSelector'
import { ChatBox } from '@/components/interview/ChatBox'
import { CompanyHistory } from '@/components/interview/CompanyHistory'
import { useInterviewChat } from '@/hooks/useInterviewChat'
import { cn } from '@/utils/cn'
import type { ActiveTab, CompanyProfile, InterviewStyle } from '@/types'
import styles from './InterviewPage.module.css'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

export default function InterviewPage(): JSX.Element {
  const [jobDescription, setJobDescription] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [style, setStyle] = useState<InterviewStyle | null>(null)
  const [activeTab, setActiveTab] = useState<ActiveTab>('jobDesc')

  const { messages, isTyping, sendMessage } = useInterviewChat(
    { jobDescription, companyName, companyContext: '' },
    style ?? 'mixed',
  )

  const isChatEnabled = jobDescription.trim().length > 0

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

    const { data, error} = await supabase
      .from('company_profiles')
      .insert({
        user_id: user.id,
        company_name: trimmedName,
      }) 
      .select('id, company_name, company_website, industry, company_size')
      .single()
    if (error) {
      console.error('InterviewPage: failed to create company profile', err)
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

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Interview Simulator</h1>
          <p className={styles.subtitle}>
            Practice answering questions live with AI. Provide context to make it realistic.
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
            <div className={styles.emptyTab}>
              <FileText size={24} className={styles.emptyIcon} />
              <p className={styles.emptyText}>
                Questions will appear here once AI generates them.
              </p>
            </div>
          )}

          {activeTab === 'companies' && (
            <div className={styles.tabContent}>
              <CompanyHistory onSelect={handleCompanyProfileSelect} />
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
