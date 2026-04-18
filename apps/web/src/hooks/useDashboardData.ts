import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type {
  DashboardData,
  ResearchSessionSummary,
  CompanySummary,
  PipelineCounts,
  DashboardRange,
  PracticeConsistencyData,
} from '@/types'

interface UseDashboardDataReturn {
  data: DashboardData | null
  isLoading: boolean
  fetchError: string | null
}

interface UseDashboardDataParams {
  practiceRange: DashboardRange
  pipelineRange: DashboardRange
}

interface RawResearchSession {
  id: string
  title: string | null
  created_at: string
  company_profiles: { company_name: string; industry: string | null } | null
}

interface RawPracticeSession {
  created_at: string
  duration_minutes: number
}

type ApplicationStatus =
  | 'applied'
  | 'phone_screen'
  | 'interviewing'
  | 'offer'
  | 'rejected'
  | 'withdrawn'

const KNOWN_STATUSES: readonly ApplicationStatus[] = [
  'applied',
  'phone_screen',
  'interviewing',
  'offer',
  'rejected',
  'withdrawn',
]

const INTERVIEW_STATUSES: readonly ApplicationStatus[] = ['phone_screen', 'interviewing']

function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return KNOWN_STATUSES.includes(value as ApplicationStatus)
}

function getStartOfIsoWeek(date: Date): Date {
  const copy = new Date(date)
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setHours(0, 0, 0, 0)
  copy.setDate(copy.getDate() + diff)
  return copy
}

function getEndOfIsoWeek(date: Date): Date {
  const start = getStartOfIsoWeek(date)
  const end = new Date(start)
  end.setDate(start.getDate() + 7)
  return end
}

function getStartOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function getEndOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1)
}

function getRangeBounds(range: DashboardRange): { start: Date; end: Date } {
  const now = new Date()

  if (range === 'week') {
    return {
      start: getStartOfIsoWeek(now),
      end: getEndOfIsoWeek(now),
    }
  }

  return {
    start: getStartOfMonth(now),
    end: getEndOfMonth(now),
  }
}

function buildPracticeBuckets(
  rows: RawPracticeSession[],
  range: DashboardRange,
): PracticeConsistencyData {
  if (range === 'week') {
    const start = getStartOfIsoWeek(new Date())
    const buckets = Array.from({ length: 7 }, () => 0)

    for (const row of rows) {
      const createdAt = new Date(row.created_at)
      const diffDays = Math.floor(
        (createdAt.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      )

      if (diffDays >= 0 && diffDays < 7) {
        buckets[diffDays] += row.duration_minutes
      }
    }

    return {
      totalMinutes: rows.reduce((sum, row) => sum + row.duration_minutes, 0),
      buckets,
    }
  }

  const buckets = Array.from({ length: 5 }, () => 0)

  for (const row of rows) {
    const createdAt = new Date(row.created_at)
    const dayOfMonth = createdAt.getDate()
    const weekIndex = Math.min(Math.floor((dayOfMonth - 1) / 7), 4)
    buckets[weekIndex] += row.duration_minutes
  }

  return {
    totalMinutes: rows.reduce((sum, row) => sum + row.duration_minutes, 0),
    buckets,
  }
}

export function useDashboardData({
  practiceRange,
  pipelineRange,
}: UseDashboardDataParams): UseDashboardDataReturn {
  const { user, loading: isAuthLoading } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthLoading) return
    if (!user) {
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    const userId = user.id

    async function fetchDashboardData(): Promise<void> {
      try {
        setIsLoading(true)

        const practiceBounds = getRangeBounds(practiceRange)
        const pipelineBounds = getRangeBounds(pipelineRange)

        const [sessionsResult, companiesResult, applicationsResult, practiceResult] =
          await Promise.all([
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
            supabase
              .from('job_applications')
              .select('status')
              .eq('user_id', userId)
              .gte('created_at', pipelineBounds.start.toISOString())
              .lt('created_at', pipelineBounds.end.toISOString()),
            supabase
              .from('practice_sessions')
              .select('created_at, duration_minutes')
              .eq('user_id', userId)
              .gte('created_at', practiceBounds.start.toISOString())
              .lt('created_at', practiceBounds.end.toISOString())
              .order('created_at', { ascending: true }),
          ])

        if (controller.signal.aborted) return

        if (sessionsResult.error) throw sessionsResult.error
        if (companiesResult.error) throw companiesResult.error
        if (applicationsResult.error) throw applicationsResult.error
        if (practiceResult.error) throw practiceResult.error

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

        const statuses = (applicationsResult.data ?? [])
          .map((row) => row.status)
          .filter(isApplicationStatus)

        const pipeline: PipelineCounts = {
          total: statuses.length,
          interviews: statuses.filter((s) => INTERVIEW_STATUSES.includes(s)).length,
          offers: statuses.filter((s) => s === 'offer').length,
        }

        const practiceRows = (practiceResult.data ?? []) as RawPracticeSession[]
        const practiceConsistency = buildPracticeBuckets(practiceRows, practiceRange)

        if (controller.signal.aborted) return
        setData({ recentSessions, companies, pipeline, practiceConsistency })
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
  }, [user, isAuthLoading, practiceRange, pipelineRange])

  return { data, isLoading, fetchError }
}