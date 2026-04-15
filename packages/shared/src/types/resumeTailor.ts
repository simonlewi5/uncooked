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
 * Raw response from backend resume-tailor function.
 * Ambiguous and optional fields — use ResumeTailorNormalizedResponse for consumer logic.
 */
export interface ResumeTailorResponse {
	edits?: ResumeTailorEdit[]
	appliedMode?: ResumeTailorMode
	isPartial?: boolean
	/** Human-readable reason set when isPartial is true (e.g. 'truncated', 'safety_filtered'). */
	warning?: string
}
