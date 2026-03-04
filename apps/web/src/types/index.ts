export type InterviewStyle = 'technical' | 'behavioral' | 'mixed' | 'friendly'

export type ActiveTab = 'jobDesc' | 'questions'

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
