export type InterviewStyle = 'technical' | 'behavioral' | 'mixed' | 'friendly'

export type ActiveTab = 'jobDesc' | 'questions' | 'companies'

export interface CompanyProfile {
  id: string
  companyName: string
  companyWebsite: string | null
  industry: string | null
  companySize: string | null
}

export interface PastJobDescription {
  id: string
  jobTitle: string
  jobDescription: string
}

export type {
  ResumeTailorInputObject,
  ResumeTailorMode,
  ResumeTailorRequest,
  ResumeTailorResponse,
} from '@uncooked/shared'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface JobDescriptionFormValue {
  jobDescription: string
  companyName: string
  companyContext: string
}

export interface ResearchSessionSummary {
  id: string
  title: string | null
  createdAt: string
  companyName: string | null
  industry: string | null
}

export interface CompanySummary {
  id: string
  companyName: string
  industry: string | null
}

export interface PipelineCounts {
  total: number
  interviews: number
  offers: number
}

export interface DashboardData {
  recentSessions: ResearchSessionSummary[]
  companies: CompanySummary[]
  pipeline: PipelineCounts
}

// ── Gamification ──────────────────────────────────────────────────────────────

export interface Badge {
  id: string
  label: string
  description: string
  icon: string // emoji
  earned: boolean
}

export interface GamificationData {
  level: number
  totalXp: number
  xpInLevel: number
  xpForNextLevel: number
  progressPct: number
  tierLabel: string
  badges: Badge[]
}
