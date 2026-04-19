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

export function countEventsByType(rows: XpEventRow[], eventType: string): number {
  return rows.filter((r) => r.event_type === eventType).length
}

export function sumLedgerXp(rows: XpEventRow[]): number {
  return rows.reduce((sum, row) => sum + (Number(row.xp_awarded) || 0), 0)
}

function ledgerCounts(xpEvents: XpEventRow[]) {
  const n = (t: string) => countEventsByType(xpEvents, t)
  return {
    eventXp: sumLedgerXp(xpEvents),
    interviewMessages: n(GAMIFICATION_EVENT_TYPES.INTERVIEW_MESSAGE),
    resumeUploads: n(GAMIFICATION_EVENT_TYPES.RESUME_SESSION_UPLOAD),
    resumeTailorRuns: n(GAMIFICATION_EVENT_TYPES.RESUME_AUTO_TAILOR),
    resumeApplyEdits: n(GAMIFICATION_EVENT_TYPES.RESUME_APPLY_TAILOR_EDIT),
    resumeDeclineEdits: n(GAMIFICATION_EVENT_TYPES.RESUME_DECLINE_TAILOR_EDIT),
    companiesAdded: n(GAMIFICATION_EVENT_TYPES.RESEARCH_COMPANY_ADDED),
    researchMessages: n(GAMIFICATION_EVENT_TYPES.RESEARCH_CHAT_MESSAGE),
  }
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
  companiesAdded: number
  researchMessages: number
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
  {
    id: 'company_scout',
    label: 'Company Scout',
    description: 'Add your first company to your research board',
    icon: '🏢',
    check: ({ companiesAdded }) => companiesAdded >= 1,
  },
  {
    id: 'curious_researcher',
    label: 'Curious Researcher',
    description: 'Ask your first research question',
    icon: '🔍',
    check: ({ researchMessages }) => researchMessages >= 1,
  },
] as const

/** Derives level, XP, and badges from session counts plus `user_xp_events` rows. */
export function computeGamificationData(sources: GamificationSources): GamificationData {
  const { practiceCount, researchCount, applicationCount, xpEvents } = sources
  const ledger = ledgerCounts(xpEvents)

  const totalXp =
    practiceCount * XP_PER_PRACTICE +
    researchCount * XP_PER_RESEARCH +
    applicationCount * XP_PER_APPLICATION +
    ledger.eventXp

  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1
  const xpInLevel = totalXp % XP_PER_LEVEL
  const xpForNextLevel = XP_PER_LEVEL
  const progressPct = Math.round((xpInLevel / XP_PER_LEVEL) * 100)
  const tierLabel = getTierLabel(level)

  const counts: Counts = {
    practice: practiceCount,
    research: researchCount,
    applications: applicationCount,
    interviewMessages: ledger.interviewMessages,
    resumeUploads: ledger.resumeUploads,
    resumeTailorRuns: ledger.resumeTailorRuns,
    resumeApplyEdits: ledger.resumeApplyEdits,
    resumeDeclineEdits: ledger.resumeDeclineEdits,
    companiesAdded: ledger.companiesAdded,
    researchMessages: ledger.researchMessages,
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
