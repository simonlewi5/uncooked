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
