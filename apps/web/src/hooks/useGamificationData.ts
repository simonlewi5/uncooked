import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Badge, GamificationData } from '@/types'

// ── XP constants ──────────────────────────────────────────────────────────────

const XP_PER_LEVEL = 200
const XP_PER_PRACTICE = 50   // completing a mock interview session
const XP_PER_RESEARCH = 25   // researching a company
const XP_PER_APPLICATION = 20 // tracking a job application

// ── Tier labels by level ──────────────────────────────────────────────────────

const TIER_THRESHOLDS: readonly [number, string][] = [
  [0, 'Job Seeker'],
  [3, 'Candidate'],
  [6, 'Contender'],
  [10, 'Interview Ace'],
  [15, 'Top Talent'],
]

function getTierLabel(level: number): string {
  const tier = [...TIER_THRESHOLDS].reverse().find(([threshold]) => level >= threshold)
  return tier?.[1] ?? 'Job Seeker'
}

// ── Badge definitions ─────────────────────────────────────────────────────────

interface Counts {
  practice: number
  research: number
  applications: number
  totalXp: number
}

type BadgeDef = Omit<Badge, 'earned'> & { check: (counts: Counts) => boolean }

const BADGE_DEFS: readonly BadgeDef[] = [
  {
    id: 'first_move',
    label: 'First Move',
    description: 'Complete your first mock interview',
    icon: '🎯',
    check: ({ practice }) => practice >= 1,
  },
  {
    id: 'researcher',
    label: 'Researcher',
    description: 'Research 3 companies',
    icon: '🔬',
    check: ({ research }) => research >= 3,
  },
  {
    id: 'pipeline_builder',
    label: 'Pipeline Builder',
    description: 'Track your first job application',
    icon: '💼',
    check: ({ applications }) => applications >= 1,
  },
  {
    id: 'interview_pro',
    label: 'Interview Pro',
    description: 'Complete 5 mock interview sessions',
    icon: '🏆',
    check: ({ practice }) => practice >= 5,
  },
  {
    id: 'champion',
    label: 'Champion',
    description: 'Earn 500 XP total',
    icon: '⭐',
    check: ({ totalXp }) => totalXp >= 500,
  },
] as const

// ── Hook ──────────────────────────────────────────────────────────────────────

interface UseGamificationDataReturn {
  data: GamificationData | null
  isLoading: boolean
}

/**
 * Derives the user's gamification state from their existing activity.
 *
 * XP is computed from counts across practice_sessions, research_sessions,
 * and job_applications — no additional writes needed. The user_xp_events
 * table (migration 009) is available for future trigger-based awards or
 * admin bonuses, but is not queried here yet.
 *
 * Separation of concerns: computation logic lives here, presentation in
 * GamificationCard. The hook can be replaced with a DB-aggregated version
 * without touching the UI.
 */
export function useGamificationData(): UseGamificationDataReturn {
  const { user, loading: isAuthLoading } = useAuth()
  const [data, setData] = useState<GamificationData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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
        // Fire all three count queries in parallel — same pattern as useDashboardData
        const [practiceResult, researchResult, applicationsResult] = await Promise.all([
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
        ])

        if (controller.signal.aborted) return

        const practiceCount = practiceResult.count ?? 0
        const researchCount = researchResult.count ?? 0
        const appCount = applicationsResult.count ?? 0

        const totalXp =
          practiceCount * XP_PER_PRACTICE +
          researchCount * XP_PER_RESEARCH +
          appCount * XP_PER_APPLICATION

        const level = Math.floor(totalXp / XP_PER_LEVEL) + 1
        const xpInLevel = totalXp % XP_PER_LEVEL
        const xpForNextLevel = XP_PER_LEVEL
        const progressPct = Math.round((xpInLevel / XP_PER_LEVEL) * 100)
        const tierLabel = getTierLabel(level)

        const counts: Counts = {
          practice: practiceCount,
          research: researchCount,
          applications: appCount,
          totalXp,
        }

        const badges: Badge[] = BADGE_DEFS.map((def) => ({
          id: def.id,
          label: def.label,
          description: def.description,
          icon: def.icon,
          earned: def.check(counts),
        }))

        setData({ level, totalXp, xpInLevel, xpForNextLevel, progressPct, tierLabel, badges })
      } catch {
        // Gamification is non-critical; a fetch failure doesn't break the Dashboard
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void fetchGamificationData()
    return () => controller.abort()
  }, [user, isAuthLoading])

  return { data, isLoading }
}
