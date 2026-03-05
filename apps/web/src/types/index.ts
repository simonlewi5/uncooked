export type InterviewStyle = 'technical' | 'behavioral' | 'mixed'

export type {
  ResumeTailorInputObject,
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
