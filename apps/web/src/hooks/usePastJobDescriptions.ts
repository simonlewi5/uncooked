import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { PastJobDescription } from '@/types'

export function usePastJobDescriptions(companyProfileId: string | null): { jobs: PastJobDescription[] } {
  const [jobs, setJobs] = useState<PastJobDescription[]>([])

  useEffect(() => {
    if (!companyProfileId) {
      setJobs([])
      return
    }
    supabase
      .from('job_applications')
      .select('id, job_title, job_description')
      .eq('company_profile_id', companyProfileId)
      .not('job_description', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data, error }) => {
        if (error) {
          console.error('usePastJobDescriptions: failed to fetch job applications', error)
          return
        }
        setJobs(
          (data ?? [])
            .filter((row) => row.job_description)
            .map((row) => ({
              id: row.id as string,
              jobTitle: row.job_title as string,
              jobDescription: row.job_description as string,
            })),
        )
      })
  }, [companyProfileId])

  return { jobs }
}
