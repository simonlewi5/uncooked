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

export interface ResumeTailorTextField {
	id: string
	text: string
}

export interface ResumeTailorBulletField extends ResumeTailorTextField {}

export interface ResumeTailorExperienceEntry {
	id: string
	title: ResumeTailorTextField
	company: ResumeTailorTextField
	period: ResumeTailorTextField
	bullets: ResumeTailorBulletField[]
}

export interface ResumeTailorEducationEntry {
	id: string
	degree: ResumeTailorTextField
	school: ResumeTailorTextField
	period: ResumeTailorTextField
}

export interface ResumeTailorResumeContent {
	name: ResumeTailorTextField
	contact: ResumeTailorTextField
	summary: ResumeTailorTextField
	experience: ResumeTailorExperienceEntry[]
	education: ResumeTailorEducationEntry[]
	skills: ResumeTailorTextField[]
}

export interface ResumeTailorRequest {
	jobDescription: string
	resumeContent: ResumeTailorResumeContent
	mode?: ResumeTailorMode
}

export type ResumeTailorMode = 'delta_only'

export type ResumeTailorEditSection = 'summary' | 'experience' | 'skills'

export interface ResumeTailorEdit {
	section: ResumeTailorEditSection
	targetId: string
	operation: 'replace' | 'insert' | 'remove'
	replacement: string
}

export interface ResumeTailorResponse {
	edits?: ResumeTailorEdit[]
	appliedMode?: ResumeTailorMode
	isPartial?: boolean
}
