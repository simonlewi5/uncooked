import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { DashboardData, ResearchSessionSummary, CompanySummary, PipelineCounts } from '@/types'

interface UseDashboardDataReturn {
  data: DashboardData | null
  isLoading: boolean
  fetchError: string | null
}

interface RawResearchSession {
  id: string
  title: string | null
  created_at: string
  company_profiles: { company_name: string; industry: string | null } | null
}

type ApplicationStatus =
  | 'applied'
  | 'phone_screen'
  | 'interviewing'
  | 'offer'
  | 'rejected'
  | 'withdrawn'

const INTERVIEW_STATUSES: ApplicationStatus[] = ['phone_screen', 'interviewing']

export function useDashboardData(): UseDashboardDataReturn {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    const userId = user.id

    async function fetchDashboardData(): Promise<void> {
      try {
        const [sessionsResult, companiesResult, applicationsResult] = await Promise.all([
          supabase
            .from('research_sessions')
            .select('id, title, created_at, company_profiles(company_name, industry)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(3),
          supabase
            .from('company_profiles')
            .select('id, company_name, industry')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(4),
          supabase.from('job_applications').select('status').eq('user_id', userId),
        ])

        if (controller.signal.aborted) return

        if (sessionsResult.error) throw sessionsResult.error
        if (companiesResult.error) throw companiesResult.error
        if (applicationsResult.error) throw applicationsResult.error

        const rawSessions = (sessionsResult.data ?? []) as unknown as RawResearchSession[]
        const recentSessions: ResearchSessionSummary[] = rawSessions.map((row) => ({
          id: row.id,
          title: row.title,
          createdAt: row.created_at,
          companyName: row.company_profiles?.company_name ?? null,
          industry: row.company_profiles?.industry ?? null,
        }))

        const companies: CompanySummary[] = (companiesResult.data ?? []).map((row) => ({
          id: row.id,
          companyName: row.company_name,
          industry: row.industry,
        }))

        const statuses = (applicationsResult.data ?? []).map((row) => row.status as ApplicationStatus)
        const pipeline: PipelineCounts = {
          applied: statuses.length,
          interviews: statuses.filter((s) => INTERVIEW_STATUSES.includes(s)).length,
          offers: statuses.filter((s) => s === 'offer').length,
        }

        if (controller.signal.aborted) return
        setData({ recentSessions, companies, pipeline })
        setFetchError(null)
      } catch (err) {
        if (controller.signal.aborted) return
        setFetchError(err instanceof Error ? err.message : 'Failed to load dashboard data')
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    fetchDashboardData()

    return () => controller.abort()
  }, [user])

  return { data, isLoading, fetchError }
}
