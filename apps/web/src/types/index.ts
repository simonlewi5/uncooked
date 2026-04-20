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

export interface CompanyRole {
  id: string
  roleTitle: string
  jobDescription: string | null
  companyProfileId: string
  createdAt: string
}

export type {
  ResumeAllowedExtension,
  ResumeAllowedMimeType,
  ResumeTailorEdit,
  ResumeDocument,
  ResumeDocumentField,
  ResumeUploadConstraints,
  ResumeTailorMode,
  ResumeParseErrorCode,
  ResumeParseResponse,
  ResumeRecordDto,
  ResumeRecordStatus,
  ResumeTailorRequest,
  ResumeTailorResponse,
  ResumeTailorNormalizedResponse,
  ResumeTailorErrorResponse,
} from '@uncooked/shared'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface CompanyRole {
  id: string
  companyProfileId: string
  roleTitle: string
  jobDescription: string | null
  isActive: boolean
  createdAt: string
}

export interface InterviewSessionSummary {
  id: string
  companyName: string
  companyProfileId: string | null
  companyRoleId: string | null
  roleTitle: string | null
  interviewStyle: string | null
  createdAt: string
  resumeId?: string | null
}

export interface InterviewQuestion {
  id: string
  interviewSessionId: string | null
  companyProfileId: string | null
  companyName: string
  questionText: string
  category: string | null
  source: 'pre_generated' | 'chat_extracted'
  isBookmarked: boolean
  answerNotes: string | null
  chatMessageId: string | null
  createdAt: string
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
  companyProfileId: string | null
  companyRoleId: string | null
  companyWebsite: string | null
}

export interface CompanySummary {
  id: string
  companyName: string
  industry: string | null
    companyWebsite: string | null
}

export type DashboardRange = 'week' | 'month'

export interface PracticeConsistencyData {
  totalMinutes: number
  buckets: number[]
  labels: string[]
}

export interface PipelineCounts {
  applied: number
  interviews: number
  offers: number
}

export interface DashboardData {
  recentSessions: ResearchSessionSummary[]
  companies: CompanySummary[]
  pipeline: PipelineCounts
  practiceConsistency: PracticeConsistencyData
}

export type ActivityType = 'resume' | 'interview' | 'research'

export type StructuredErrorResponse = {
  message: string
  code?: string
}

export type DailyDuration = {
  date: string
  minutes: number
}

export type ActivityMetric = {
  activityType: ActivityType
  currentStreakDays: number
  longestStreakDays: number
  sessionsLast7d: number
  sessionsLast30d: number
  lastActiveDate: string | null
  dailyMinutes: DailyDuration[]
}

export type ConsistencyMetric = ActivityMetric

export type ConsistencyMetrics = Record<ActivityType, ActivityMetric>

export type ResumeNode = { text?: string }

export interface StructuredResumeData {
  name?: ResumeNode
  contact?: ResumeNode
  summary?: ResumeNode
  experience?: Array<{
    title?: ResumeNode
    company?: ResumeNode
    period?: ResumeNode
    bullets?: Array<ResumeNode>
  }>
  skills?: Array<ResumeNode>
}

export interface ResumeSummary {
  id: string
  title: string
  is_primary: boolean
  updated_at: string
  structured_content: StructuredResumeData | null 
  source_file_path: string | null 
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
