import { createContext, useContext, useMemo } from 'react'
import useSWR from 'swr'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type {
  ActivityType,
  ConsistencyMetrics,
  ConsistencyMetric,
  StructuredErrorResponse,
} from '@/types'

type RawConsistencyRow = {
  activity_type: ActivityType
  current_streak_days: number
  longest_streak_days: number
  sessions_last_7d: number
  sessions_last_30d: number
  last_active_date: string | null
}

type ConsistencyMetricsContextValue = {
  data: ConsistencyMetrics | null
  isLoading: boolean
  error: StructuredErrorResponse | null
  refresh: () => Promise<void>
}

const ConsistencyMetricsContext = createContext<ConsistencyMetricsContextValue | null>(null)

const emptyMetric = (activityType: ActivityType): ConsistencyMetric => ({
  activityType,
  currentStreakDays: 0,
  longestStreakDays: 0,
  sessionsLast7d: 0,
  sessionsLast30d: 0,
  lastActiveDate: null,
})

const normalizeRows = (rows: RawConsistencyRow[] | null): ConsistencyMetrics => {
  const mapped: ConsistencyMetrics = {
    resume: emptyMetric('resume'),
    interview: emptyMetric('interview'),
    research: emptyMetric('research'),
  }

  for (const row of rows ?? []) {
    mapped[row.activity_type] = {
      activityType: row.activity_type,
      currentStreakDays: Number(row.current_streak_days ?? 0),
      longestStreakDays: Number(row.longest_streak_days ?? 0),
      sessionsLast7d: Number(row.sessions_last_7d ?? 0),
      sessionsLast30d: Number(row.sessions_last_30d ?? 0),
      lastActiveDate: row.last_active_date,
    }
  }

  return mapped
}

export function ConsistencyMetricsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()

  const { data, error, isLoading, mutate } = useSWR<ConsistencyMetrics, StructuredErrorResponse>(
    user?.id ? ['consistency-metrics', user.id] : null,
    async ([, userId]) => {
      const { data: rows, error } = await supabase.rpc('get_consistency_metrics', {
        p_user_id: userId,
      })

      if (error) {
        throw {
          message: error.message,
          code: error.code,
        } satisfies StructuredErrorResponse
      }

      return normalizeRows((rows ?? null) as RawConsistencyRow[] | null)
    },
    {
      dedupingInterval: 60_000,
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  )

  const value = useMemo<ConsistencyMetricsContextValue>(
    () => ({
      data: data ?? null,
      isLoading,
      error: error ?? null,
      refresh: async () => {
        await mutate()
      },
    }),
    [data, error, isLoading, mutate]
  )

  return (
    <ConsistencyMetricsContext.Provider value={value}>
      {children}
    </ConsistencyMetricsContext.Provider>
  )
}

export function useConsistencyMetrics(): ConsistencyMetricsContextValue {
  const context = useContext(ConsistencyMetricsContext)
  if (!context) {
    throw new Error('useConsistencyMetrics must be used within ConsistencyMetricsProvider')
  }
  return context
}
