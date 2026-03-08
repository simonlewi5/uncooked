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

export interface ResumeTailorResponse {
	tailoredResume: string
	suggestions: string[]
}
