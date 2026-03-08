import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { PastJobDescription } from '@/types'

interface JobApplicationRow {
  id: string
  job_title: string
  job_description: string
}

function isJobApplicationRow(row: unknown): row is JobApplicationRow {
  return (
    typeof row === 'object' &&
    row !== null &&
    typeof (row as Record<string, unknown>).id === 'string' &&
    typeof (row as Record<string, unknown>).job_title === 'string' &&
    typeof (row as Record<string, unknown>).job_description === 'string'
  )
}

export function usePastJobDescriptions(companyProfileId: string | null): { jobs: PastJobDescription[] } {
  const [jobs, setJobs] = useState<PastJobDescription[]>([])

  useEffect(() => {
    if (!companyProfileId) {
      setJobs([])
      return
    }
    let isCancelled = false
    supabase
      .from('job_applications')
      .select('id, job_title, job_description')
      .eq('company_profile_id', companyProfileId)
      .not('job_description', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data, error }) => {
        if (isCancelled) return
        if (error) {
          console.error('usePastJobDescriptions: failed to fetch job applications', error)
          return
        }
        setJobs(
          (data ?? []).filter(isJobApplicationRow).map((row) => ({
            id: row.id,
            jobTitle: row.job_title,
            jobDescription: row.job_description,
          })),
        )
      })
    return () => {
      isCancelled = true
    }
  }, [companyProfileId])

  return { jobs }
}
