import type { Badge, GamificationData } from '@/types'
import { GAMIFICATION_EVENT_TYPES } from './eventCatalog'

export const XP_PER_LEVEL = 200
export const XP_PER_PRACTICE = 50
export const XP_PER_RESEARCH = 25
export const XP_PER_APPLICATION = 20

export interface XpEventRow {
  event_type: string
  xp_awarded: number
}

export interface GamificationSources {
  practiceCount: number
  researchCount: number
  applicationCount: number
  xpEvents: XpEventRow[]
}

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

/** Count rows with a given event_type (each row = one action, e.g. one chat message). */
export function countEventsByType(rows: XpEventRow[], eventType: string): number {
  return rows.filter((r) => r.event_type === eventType).length
}

/** Sum of xp_awarded across all ledger rows (interview + resume + future events). */
export function sumLedgerXp(rows: XpEventRow[]): number {
  return rows.reduce((sum, row) => sum + (Number(row.xp_awarded) || 0), 0)
}

interface Counts {
  practice: number
  research: number
  applications: number
  interviewMessages: number
  resumeUploads: number
  resumeTailorRuns: number
  resumeApplyEdits: number
  resumeDeclineEdits: number
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
    id: 'warming_up',
    label: 'Warming Up',
    description: 'Send 25 interview messages',
    icon: '🔥',
    check: ({ interviewMessages }) => interviewMessages >= 25,
  },
  {
    id: 'marathon_talker',
    label: 'Marathon Talker',
    description: 'Send 100 interview messages',
    icon: '🎙️',
    check: ({ interviewMessages }) => interviewMessages >= 100,
  },
  {
    id: 'champion',
    label: 'Champion',
    description: 'Earn 500 XP total',
    icon: '⭐',
    check: ({ totalXp }) => totalXp >= 500,
  },
  {
    id: 'resume_on_file',
    label: 'Resume on File',
    description: 'Upload a resume for a tailoring session',
    icon: '📄',
    check: ({ resumeUploads }) => resumeUploads >= 1,
  },
  {
    id: 'tailor_pilot',
    label: 'Tailor Pilot',
    description: 'Run Auto-Tailor at least once',
    icon: '✨',
    check: ({ resumeTailorRuns }) => resumeTailorRuns >= 1,
  },
  {
    id: 'edit_adopter',
    label: 'Edit Adopter',
    description: 'Apply 5 tailored suggestions to your resume',
    icon: '✅',
    check: ({ resumeApplyEdits }) => resumeApplyEdits >= 5,
  },
  {
    id: 'careful_reviewer',
    label: 'Careful Reviewer',
    description: 'Decline at least 3 suggestions you chose not to use',
    icon: '🧭',
    check: ({ resumeDeclineEdits }) => resumeDeclineEdits >= 3,
  },
] as const

/**
 * Pure computation from aggregate sources (used by the dashboard hook and tests).
 */
export function computeGamificationData(sources: GamificationSources): GamificationData {
  const { practiceCount, researchCount, applicationCount, xpEvents } = sources

  const eventXp = sumLedgerXp(xpEvents)
  const interviewMessages = countEventsByType(xpEvents, GAMIFICATION_EVENT_TYPES.INTERVIEW_MESSAGE)
  const resumeUploads = countEventsByType(xpEvents, GAMIFICATION_EVENT_TYPES.RESUME_SESSION_UPLOAD)
  const resumeTailorRuns = countEventsByType(xpEvents, GAMIFICATION_EVENT_TYPES.RESUME_AUTO_TAILOR)
  const resumeApplyEdits = countEventsByType(xpEvents, GAMIFICATION_EVENT_TYPES.RESUME_APPLY_TAILOR_EDIT)
  const resumeDeclineEdits = countEventsByType(xpEvents, GAMIFICATION_EVENT_TYPES.RESUME_DECLINE_TAILOR_EDIT)

  const totalXp =
    practiceCount * XP_PER_PRACTICE +
    researchCount * XP_PER_RESEARCH +
    applicationCount * XP_PER_APPLICATION +
    eventXp

  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1
  const xpInLevel = totalXp % XP_PER_LEVEL
  const xpForNextLevel = XP_PER_LEVEL
  const progressPct = Math.round((xpInLevel / XP_PER_LEVEL) * 100)
  const tierLabel = getTierLabel(level)

  const counts: Counts = {
    practice: practiceCount,
    research: researchCount,
    applications: applicationCount,
    interviewMessages,
    resumeUploads,
    resumeTailorRuns,
    resumeApplyEdits,
    resumeDeclineEdits,
    totalXp,
  }

  const badges: Badge[] = BADGE_DEFS.map((def) => ({
    id: def.id,
    label: def.label,
    description: def.description,
    icon: def.icon,
    earned: def.check(counts),
  }))

  return { level, totalXp, xpInLevel, xpForNextLevel, progressPct, tierLabel, badges }
}

export function diffNewlyEarnedBadges(before: GamificationData, after: GamificationData): Badge[] {
  return after.badges.filter((b) => {
    if (!b.earned) return false
    const prev = before.badges.find((x) => x.id === b.id)
    return !prev?.earned
  })
}
