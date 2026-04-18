import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { computeGamificationData, type GamificationSources } from '@/lib/gamification'
import type { GamificationData } from '@/types'

interface UseGamificationDataReturn {
  data: GamificationData | null
  isLoading: boolean
  /** Refetch gamification (e.g. after awarding XP elsewhere). */
  refetch: () => void
}

/**
 * Derives the user's gamification state from practice/research/applications counts
 * plus the `user_xp_events` ledger (interview messages, resume tailoring, etc.).
 */
export function useGamificationData(): UseGamificationDataReturn {
  const { user, loading: isAuthLoading } = useAuth()
  const [data, setData] = useState<GamificationData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [tick, setTick] = useState(0)

  const refetch = () => setTick((t) => t + 1)

  useEffect(() => {
    if (isAuthLoading) return
    if (!user) {
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    const userId = user.id

    async function fetchGamificationData(): Promise<void> {
      try {
        const [practiceResult, researchResult, applicationsResult, xpEventsResult] = await Promise.all([
          supabase
            .from('practice_sessions')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId),
          supabase
            .from('research_sessions')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId),
          supabase
            .from('job_applications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId),
          supabase.from('user_xp_events').select('xp_awarded, event_type').eq('user_id', userId),
        ])

        if (controller.signal.aborted) return

        const sources: GamificationSources = {
          practiceCount: practiceResult.count ?? 0,
          researchCount: researchResult.count ?? 0,
          applicationCount: applicationsResult.count ?? 0,
          xpEvents: (xpEventsResult.data ?? []) as GamificationSources['xpEvents'],
        }

        setData(computeGamificationData(sources))
      } catch {
        // Gamification is non-critical; a fetch failure doesn't break the Dashboard
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void fetchGamificationData()
    return () => controller.abort()
  }, [user, isAuthLoading, tick])

  return { data, isLoading, refetch }
}
