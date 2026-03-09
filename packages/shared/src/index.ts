// Shared types and utilities
// Add exports here as the app grows

export type { Database } from './types/database'

export type ResumeTailorInputValue =
	| string
	| number
	| boolean
	| null
	| ResumeTailorInputObject
	| ResumeTailorInputArray

export interface ResumeTailorInputObject {
	[key: string]: ResumeTailorInputValue
}

export interface ResumeTailorInputArray extends Array<ResumeTailorInputValue> {}

export interface ResumeTailorRequest {
	jobDescription: string
	resumeContent: string | ResumeTailorInputObject
	skills?: string[]
}

export interface ResumeTailorStructuredExperience {
	title: string
	company: string
	period: string
	bullets: string[]
}

export interface ResumeTailorStructuredEducation {
	degree: string
	school: string
	period: string
}

export interface ResumeTailorStructuredSection {
	title: string
	content: string
}

export interface ResumeTailorStructuredResume {
	name?: string
	contact?: string
	summary?: string
	experience: ResumeTailorStructuredExperience[]
	education: ResumeTailorStructuredEducation[]
	skills: string[]
	extraSections: ResumeTailorStructuredSection[]
}

export interface ResumeTailorResponse {
	tailoredResume: string
	suggestions: string[]
	structuredResume: ResumeTailorStructuredResume
	parseConfidence: number
	warnings: string[]
}
