/** Backend API contract for resume tailoring requests and responses. */

import type { ResumeDocument } from './resumeDocument'

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

/**
 * Backend HTTP 200 response — success case with explicit status.
 * HTTP 4xx/5xx already signal errors, so 200 always means success.
 */
export type ResumeTailorResponse =
	| {
			status: 'success'
			edits: ResumeTailorEdit[]
			appliedMode: ResumeTailorMode
		}
	| {
			status: 'success_empty'
			edits: []
			appliedMode: ResumeTailorMode
		}
