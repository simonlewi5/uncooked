/**
 * Normalized resume tailor responses — the hook's contract to components.
 * Single source of truth for all tailor outcomes.
 * useResumeTailor() normalizes raw backend responses into one of these 4 statuses.
 *
 * Components switch on `status` to handle each case. All variants expose `edits`
 * so callers never need to guard before iterating (error/empty variants carry `[]`).
 */

import type { ResumeTailorEdit, ResumeTailorMode } from './resumeTailor'

export interface ResumeTailorSuccessResponse {
	status: 'success'
	/** 1 or more edits returned from the AI. */
	edits: ResumeTailorEdit[]
	appliedMode: ResumeTailorMode
}

export interface ResumeTailorSuccessEmptyResponse {
	status: 'success_empty'
	/** Resume already aligned — AI returned 0 edits. */
	edits: []
	appliedMode: ResumeTailorMode
}

export interface ResumeTailorPartialResponse {
	status: 'partial'
	/** AI response was truncated. May contain 0 or more edits. */
	edits: ResumeTailorEdit[]
	appliedMode: ResumeTailorMode
}

export interface ResumeTailorErrorResponse {
	status: 'error'
	/** Always empty — no edits on error. */
	edits: []
	appliedMode: null
}

/**
 * Discriminated union of all possible tailor outcomes.
 * Hook returns this; components switch on `status` to handle each case.
 */
export type ResumeTailorNormalizedResponse =
	| ResumeTailorSuccessResponse
	| ResumeTailorSuccessEmptyResponse
	| ResumeTailorPartialResponse
	| ResumeTailorErrorResponse
