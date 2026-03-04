export type InterviewStyle = 'technical' | 'behavioral' | 'mixed'

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
  applied: number
  interviews: number
  offers: number
}

export interface DashboardData {
  recentSessions: ResearchSessionSummary[]
  companies: CompanySummary[]
  pipeline: PipelineCounts
}
