/** PDF parsing response types — returned by the resume parser when uploading a file. */

import type { ResumeDocument } from './resumeDocument'

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
