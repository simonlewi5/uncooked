// Shared types and utilities
// Add exports here as the app grows

export type { Database } from './types/database'

export interface ResumeDocumentField {
	id: string
	text: string
}

export interface ResumeDocumentExperienceEntry {
	id: string
	title: ResumeDocumentField
	company: ResumeDocumentField
	period: ResumeDocumentField
	bullets: ResumeDocumentField[]
}

export interface ResumeDocumentEducationEntry {
	id: string
	degree: ResumeDocumentField
	school: ResumeDocumentField
	period: ResumeDocumentField
}

export interface ResumeDocument {
	name: ResumeDocumentField
	contact: ResumeDocumentField
	summary: ResumeDocumentField
	experience: ResumeDocumentExperienceEntry[]
	education: ResumeDocumentEducationEntry[]
	skills: ResumeDocumentField[]
}

export interface ResumeTailorRequest {
	jobDescription: string
	resumeContent: ResumeDocument
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

export const RESUME_UPLOAD_MAX_BYTES = 5 * 1024 * 1024

export const RESUME_ALLOWED_EXTENSIONS = ['pdf'] as const
export type ResumeAllowedExtension = (typeof RESUME_ALLOWED_EXTENSIONS)[number]

export const RESUME_ALLOWED_MIME_TYPES = ['application/pdf'] as const
export type ResumeAllowedMimeType = (typeof RESUME_ALLOWED_MIME_TYPES)[number]

export interface ResumeUploadConstraints {
	maxBytes: number
	allowedExtensions: readonly ResumeAllowedExtension[]
	allowedMimeTypes: readonly ResumeAllowedMimeType[]
}

export const RESUME_UPLOAD_CONSTRAINTS: ResumeUploadConstraints = {
	maxBytes: RESUME_UPLOAD_MAX_BYTES,
	allowedExtensions: RESUME_ALLOWED_EXTENSIONS,
	allowedMimeTypes: RESUME_ALLOWED_MIME_TYPES,
}

export type ResumeParseErrorCode =
	| 'unsupported_format'
	| 'file_too_large'
	| 'invalid_file'

export type ResumeParseStatus = 'parsed' | 'partial' | 'failed'

export interface ResumeParseWarning {
	code: string
	message: string
	fieldId?: string
}

export interface ResumeParseResponse {
	status: ResumeParseStatus
	structuredContent?: ResumeDocument
	warnings?: ResumeParseWarning[]
	errorCode?: ResumeParseErrorCode
	errorMessage?: string
}

export type ResumeRecordStatus = 'pending_parse' | 'parsed' | 'partial' | 'failed' | 'edited'

export interface ResumeRecordDto {
	id: string
	userId: string
	title: string
	structuredContent: ResumeDocument | null
	filePath: string | null
	fileName: string | null
	fileMimeType: string | null
	fileSize: number | null
	status: ResumeRecordStatus
	parseError: string | null
	isPrimary: boolean
	createdAt: string
	updatedAt: string
}
