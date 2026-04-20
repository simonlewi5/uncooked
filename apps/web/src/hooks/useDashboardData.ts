import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toLocalDateString } from '@/utils/localDate'
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
  company_profile_id: string | null
  company_role_id: string | null
  company_profiles: { company_name: string; industry: string | null; company_website: string | null } | null
}

interface RawDailyMinutes {
  practice_date: string
  duration_minutes: number
}

type ApplicationStatus =
  | 'saved'
  | 'applied'
  | 'phone_screen'
  | 'interviewing'
  | 'offer'
  | 'rejected'
  | 'withdrawn'

const KNOWN_STATUSES: readonly ApplicationStatus[] = [
  'saved',
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
  rows: RawDailyMinutes[],
  range: DashboardRange,
): PracticeConsistencyData {
  const totalMinutes = rows.reduce((sum, row) => sum + row.duration_minutes, 0)

  if (range === 'week') {
    const buckets = Array.from({ length: 7 }, () => 0)
    for (const row of rows) {
      // Append T00:00:00 (no Z) so the date is parsed in local time.
      const localDay = new Date(row.practice_date + 'T00:00:00').getDay()
      const isoDay = localDay === 0 ? 6 : localDay - 1 // Mon=0 … Sun=6
      buckets[isoDay] += row.duration_minutes
    }
    return { totalMinutes, buckets }
  }

  const buckets = Array.from({ length: 5 }, () => 0)
  for (const row of rows) {
    const dayOfMonth = new Date(row.practice_date + 'T00:00:00').getDate()
    const weekIndex = Math.min(Math.floor((dayOfMonth - 1) / 7), 4)
    buckets[weekIndex] += row.duration_minutes
  }
  return { totalMinutes, buckets }
}

export function useDashboardData({
  practiceRange,
  pipelineRange,
}: UseDashboardDataParams): UseDashboardDataReturn {
  const { user, loading: isAuthLoading } = useAuth()
  const [recentSessions, setRecentSessions] = useState<ResearchSessionSummary[] | null>(null)
  const [companies, setCompanies] = useState<CompanySummary[] | null>(null)
  const [pipeline, setPipeline] = useState<PipelineCounts | null>(null)
  const [practiceConsistency, setPracticeConsistency] = useState<PracticeConsistencyData | null>(null)
  
  const [fetchError, setFetchError] = useState<string | null>(null)

  const isInitialLoad = !recentSessions || !companies || !pipeline || !practiceConsistency
  const isLoading = isAuthLoading || (isInitialLoad && !fetchError)

  useEffect(() => {
    // if (isAuthLoading) return
    if (!user) {
      return
    }

    const controller = new AbortController()
    const userId = user.id

  //   async function fetchDashboardData(): Promise<void> {
  //     try {
  //       setIsLoading(true)

  //       const practiceBounds = getRangeBounds(practiceRange)
  //       const pipelineBounds = getRangeBounds(pipelineRange)

  //       const [sessionsResult, companiesResult, applicationsResult, practiceResult] =
  //         await Promise.all([
  //           supabase
  //             .from('research_sessions')
  //             .select('id, title, created_at, company_profiles(company_name, industry)')
  //             .eq('user_id', userId)
  //             .order('created_at', { ascending: false })
  //             .limit(3),
  //           supabase
  //             .from('company_profiles')
  //             .select('id, company_name, industry')
  //             .eq('user_id', userId)
  //             .order('created_at', { ascending: false })
  //             .limit(4),
  //           supabase
  //             .from('job_applications')
  //             .select('status')
  //             .eq('user_id', userId)
  //             .gte('created_at', pipelineBounds.start.toISOString())
  //             .lt('created_at', pipelineBounds.end.toISOString()),
  //           supabase
  //             .from('practice_sessions')
  //             .select('created_at, duration_minutes')
  //             .eq('user_id', userId)
  //             .gte('created_at', practiceBounds.start.toISOString())
  //             .lt('created_at', practiceBounds.end.toISOString())
  //             .order('created_at', { ascending: true }),
  //         ])

  //       if (controller.signal.aborted) return

  //       if (sessionsResult.error) throw sessionsResult.error
  //       if (companiesResult.error) throw companiesResult.error
  //       if (applicationsResult.error) throw applicationsResult.error
  //       if (practiceResult.error) throw practiceResult.error

  //       const rawSessions = (sessionsResult.data ?? []) as unknown as RawResearchSession[]
  //       const recentSessions: ResearchSessionSummary[] = rawSessions.map((row) => ({
  //         id: row.id,
  //         title: row.title,
  //         createdAt: row.created_at,
  //         companyName: row.company_profiles?.company_name ?? null,
  //         industry: row.company_profiles?.industry ?? null,
  //       }))

  //       const companies: CompanySummary[] = (companiesResult.data ?? []).map((row) => ({
  //         id: row.id,
  //         companyName: row.company_name,
  //         industry: row.industry,
  //       }))

  //       const statuses = (applicationsResult.data ?? [])
  //         .map((row) => row.status)
  //         .filter(isApplicationStatus)

  //       const pipeline: PipelineCounts = {
  //         total: statuses.length,
  //         interviews: statuses.filter((s) => INTERVIEW_STATUSES.includes(s)).length,
  //         offers: statuses.filter((s) => s === 'offer').length,
  //       }

  //       const practiceRows = (practiceResult.data ?? []) as RawPracticeSession[]
  //       const practiceConsistency = buildPracticeBuckets(practiceRows, practiceRange)

  //       if (controller.signal.aborted) return
  //       setData({ recentSessions, companies, pipeline, practiceConsistency })
  //       setFetchError(null)
  //     } catch (err) {
  //       if (controller.signal.aborted) return
  //       setFetchError(err instanceof Error ? err.message : 'Failed to load dashboard data')
  //     } finally {
  //       if (!controller.signal.aborted) {
  //         setIsLoading(false)
  //       }
  //     }
  //   }

  //   fetchDashboardData()

  //   return () => controller.abort()
  // }, [user, isAuthLoading, practiceRange, pipelineRange])
    async function fetchCoreData() {
      try {
        const [sessionsRes, companiesRes] = await Promise.all([
          supabase
            .from('research_sessions')
            .select('id, title, created_at, company_profile_id, company_role_id, company_profiles(company_name, industry, company_website)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(3)
            .abortSignal(controller.signal),
          supabase
            .from('company_profiles')
            .select('id, company_name, industry')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(4)
            .abortSignal(controller.signal),
        ])

        if (sessionsRes.error) throw sessionsRes.error
        if (companiesRes.error) throw companiesRes.error

        const rawSessions = (sessionsRes.data ?? []) as unknown as RawResearchSession[]
        setRecentSessions(rawSessions.map((row) => ({
          id: row.id,
          title: row.title,
          createdAt: row.created_at,
          companyName: row.company_profiles?.company_name ?? null,
          industry: row.company_profiles?.industry ?? null,
          companyProfileId: row.company_profile_id ?? null,
          companyRoleId: row.company_role_id ?? null,
          companyWebsite: row.company_profiles?.company_website ?? null,
        })))

        setCompanies((companiesRes.data ?? []).map((row) => ({
          id: row.id,
          companyName: row.company_name,
          industry: row.industry,
        })))
      } catch (err) {
        if (!controller.signal.aborted) {
          setFetchError(err instanceof Error ? err.message : 'Failed to load core data')
        }
      }
    }

    fetchCoreData()
    return () => controller.abort()
  }, [user])
  // EFFECT 2: Practice Consistency (Re-runs ONLY when practiceRange changes)
  useEffect(() => {
    if (!user) return
    const controller = new AbortController()

    async function fetchPractice() {
      try {
        const bounds = getRangeBounds(practiceRange)
        const { data, error } = await supabase.rpc('get_daily_duration', {
          p_start_date: toLocalDateString(bounds.start),
          p_end_date:   toLocalDateString(bounds.end),
        }).abortSignal(controller.signal)

        if (error) throw error

        setPracticeConsistency(buildPracticeBuckets((data ?? []) as RawDailyMinutes[], practiceRange))
      } catch (err) {
        if (!controller.signal.aborted) {
          setFetchError(err instanceof Error ? err.message : 'Failed to load practice data')
        }
      }
    }

    fetchPractice()
    return () => controller.abort()
  }, [user, practiceRange])

  // EFFECT 3: Pipeline Data (Re-runs ONLY when pipelineRange changes)
  useEffect(() => {
    if (!user) return
    const controller = new AbortController()
    const userId = user.id

    async function fetchPipeline() {
      try {
        const bounds = getRangeBounds(pipelineRange)
        const { data, error } = await supabase
          .from('job_applications')
          .select('status')
          .eq('user_id', userId)
          .gte('created_at', bounds.start.toISOString())
          .lt('created_at', bounds.end.toISOString())
          .abortSignal(controller.signal)

        if (error) throw error

        const statuses = (data ?? []).map((row) => row.status).filter(isApplicationStatus)
        setPipeline({
          applied: statuses.filter((s) => s === 'applied').length,
          interviews: statuses.filter((s) => INTERVIEW_STATUSES.includes(s)).length,
          offers: statuses.filter((s) => s === 'offer').length,
        })
      } catch (err) {
        if (!controller.signal.aborted) {
          setFetchError(err instanceof Error ? err.message : 'Failed to load pipeline data')
        }
      }
    }

    fetchPipeline()
    return () => controller.abort()
  }, [user, pipelineRange])
  

  const data: DashboardData | null =
    !isInitialLoad
      ? {
          recentSessions: recentSessions!,
          companies: companies!,
          pipeline: pipeline!,
          practiceConsistency: practiceConsistency!,
        }
      : null

  return { data, isLoading, fetchError }
}