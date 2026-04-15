/**
 * Normalized resume tailor responses — the hook's contract to components.
 * Single source of truth for all tailor outcomes.
 * useResumeTailor() normalizes raw backend responses into one of these 4 statuses.
 */

import type { ResumeTailorEdit, ResumeTailorMode } from './resumeTailor'

export interface ResumeTailorSuccessResponse {
	status: 'success'
	/** 1 or more edits returned from AI. */
	edits: ResumeTailorEdit[]
	editCount: number
	/** Total edits ready for review. Always >= 1. */
	appliedMode: ResumeTailorMode
	retryable: false
	messages: {
		error: null
		warning: null
	}
}

export interface ResumeTailorSuccessEmptyResponse {
	status: 'success_empty'
	/** Resume already aligned with job description. 0 edits. */
	edits: []
	editCount: 0
	appliedMode: ResumeTailorMode
	retryable: false
	messages: {
		error: null
		warning: null
	}
}

export interface ResumeTailorPartialResponse {
	status: 'partial'
	/** AI response was truncated. May have 0 or more edits. */
	edits: ResumeTailorEdit[]
	editCount: number
	appliedMode: ResumeTailorMode
	retryable: true
	messages: {
		error: null
		warning: string
	}
}

export interface ResumeTailorErrorResponse {
	status: 'error'
	/** All errors. editCount always 0. */
	edits: []
	editCount: 0
	appliedMode: null
	/** True if error is transient (rate limit, network, server). False if permanent (auth, validation). */
	retryable: boolean
	messages: {
		error: string
		warning: null
	}
}

/**
 * Discriminated union of all possible tailor outcomes.
 * Hook returns this; components use switch(status) to handle each case.
 */
export type ResumeTailorNormalizedResponse =
	| ResumeTailorSuccessResponse
	| ResumeTailorSuccessEmptyResponse
	| ResumeTailorPartialResponse
	| ResumeTailorErrorResponse
