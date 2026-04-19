import { createContext, useContext, useMemo } from 'react'
import useSWR from 'swr'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type {
  ActivityType,
  ActivityMetric,
  DailyDuration,
  ConsistencyMetrics,
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

type RawDurationRow = {
  activity_type: ActivityType
  practice_date: string
  duration_minutes: number
}

function last7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().slice(0, 10)
  })
}

type ConsistencyMetricsContextValue = {
  data: ConsistencyMetrics | null
  durationError: StructuredErrorResponse | null
  isLoading: boolean
  error: StructuredErrorResponse | null
  refresh: () => Promise<void>
}

const ConsistencyMetricsContext = createContext<ConsistencyMetricsContextValue | null>(null)

const emptyDailyMinutes = (): DailyDuration[] =>
  last7Days().map((date) => ({ date, minutes: 0 }))

const emptyMetric = (activityType: ActivityType): ActivityMetric => ({
  activityType,
  currentStreakDays: 0,
  longestStreakDays: 0,
  sessionsLast7d: 0,
  sessionsLast30d: 0,
  lastActiveDate: null,
  dailyMinutes: emptyDailyMinutes(),
})

const normalizeRows = (
  rows: RawConsistencyRow[] | null,
  durationRows: RawDurationRow[] | null
): ConsistencyMetrics => {
  const dates = last7Days()
  const mapped: ConsistencyMetrics = {
    resume: emptyMetric('resume'),
    interview: emptyMetric('interview'),
    research: emptyMetric('research'),
  }

  const durationMap = new Map<string, Map<string, number>>()
  for (const row of durationRows ?? []) {
    const activityKey = row.activity_type
    const perActivity = durationMap.get(activityKey) ?? new Map<string, number>()
    perActivity.set(row.practice_date, Number(row.duration_minutes ?? 0))
    durationMap.set(activityKey, perActivity)
  }

  for (const row of rows ?? []) {
    mapped[row.activity_type] = {
      activityType: row.activity_type,
      currentStreakDays: Number(row.current_streak_days ?? 0),
      longestStreakDays: Number(row.longest_streak_days ?? 0),
      sessionsLast7d: Number(row.sessions_last_7d ?? 0),
      sessionsLast30d: Number(row.sessions_last_30d ?? 0),
      lastActiveDate: row.last_active_date,
      dailyMinutes: dates.map((date) => ({
        date,
        minutes: durationMap.get(row.activity_type)?.get(date) ?? 0,
      })),
    }
  }

  for (const activityType of ['resume', 'interview', 'research'] as const) {
    if (!rows?.some((row) => row.activity_type === activityType)) {
      mapped[activityType] = {
        ...mapped[activityType],
        dailyMinutes: dates.map((date) => ({
          date,
          minutes: durationMap.get(activityType)?.get(date) ?? 0,
        })),
      }
    }
  }

  return mapped
}

export function ConsistencyMetricsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()

  const { data, error, isLoading, mutate } = useSWR<
    { metrics: ConsistencyMetrics; durationError: StructuredErrorResponse | null },
    StructuredErrorResponse
  >(
    user?.id ? ['consistency-metrics', user.id] : null,
    async () => {
      const [metricsResult, durationResult] = await Promise.all([
        supabase.rpc('get_consistency_metrics'),
        supabase.rpc('get_daily_duration'),
      ])

      if (metricsResult.error) {
        throw {
          message: metricsResult.error.message,
          code: metricsResult.error.code,
        } satisfies StructuredErrorResponse
      }

      const durationError = durationResult.error
        ? {
            message: durationResult.error.message,
            code: durationResult.error.code,
          }
        : null

      return {
        metrics: normalizeRows(
          (metricsResult.data ?? null) as RawConsistencyRow[] | null,
          (durationResult.data ?? null) as RawDurationRow[] | null
        ),
        durationError,
      }
    },
    {
      dedupingInterval: 60_000,
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  )

  const value = useMemo<ConsistencyMetricsContextValue>(
    () => ({
      data: data?.metrics ?? null,
      durationError: data?.durationError ?? null,
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

// eslint-disable-next-line react-refresh/only-export-components
export function useConsistencyMetrics(): ConsistencyMetricsContextValue {
  const context = useContext(ConsistencyMetricsContext)
  if (!context) {
    throw new Error('useConsistencyMetrics must be used within ConsistencyMetricsProvider')
  }
  return context
}
