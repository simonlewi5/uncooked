import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { CompanyProfile, ResumeSummary } from '@/types'

// Find company id. 
async function getCompanyProfileId(userId: string, companyName: string): Promise<string | null> {
  const trimmed = companyName.trim()
  if (!trimmed) return null
  try {
    const { data } = await supabase
      .from('company_profiles')
      .select('id')
      .eq('user_id', userId)
      .ilike('company_name', trimmed)
      .limit(1)
    return data && data.length > 0 ? (data[0].id as string) : null
  } catch {
    return null
  }
}

export function useInterviewSetup(
  companyName: string,
  selectedCompanyId: string | null,
  setSelectedCompanyId: (id: string) => void,
  setActiveResume: (resume: ResumeSummary) => void,
  startInterviewAction: () => void 
) {
  const { user } = useAuth()
  const [showCompanyModal, setShowCompanyModal] = useState(false)
  const [pendingResume, setPendingResume] = useState<ResumeSummary | null | undefined>(null)

  async function handleStart(resumeObject?: ResumeSummary | null) {
    if (!user) return

    let finalCompanyId = selectedCompanyId
    
    if (companyName.trim() && !finalCompanyId) {
      finalCompanyId = await getCompanyProfileId(user.id, companyName)
      
      if (!finalCompanyId) {
        setPendingResume(resumeObject)
        setShowCompanyModal(true)
        return 
      }
      setSelectedCompanyId(finalCompanyId)
    }

    if (resumeObject) setActiveResume(resumeObject)
    startInterviewAction()
  }

  function handleModalSuccess(newProfile: CompanyProfile, onProfileSelect: (p: CompanyProfile) => void) {
    onProfileSelect(newProfile)
    setShowCompanyModal(false)
    if (pendingResume) setActiveResume(pendingResume)
    startInterviewAction()
  }

  return {
    showCompanyModal,
    setShowCompanyModal,
    handleStart,
    handleModalSuccess
  }
}