/**
 * Hook's response contract to components — union of success and error outcomes.
 * Combines backend's explicit status (on 200) with error state (on 4xx/5xx).
 *
 * Components switch on `status` to handle each case. All variants expose `edits`
 * so callers never need to guard before iterating (error variant carries `[]`).
 */

import type { ResumeTailorResponse } from './resumeTailor'

/**
 * Error state: HTTP 4xx/5xx or network failure.
 * Companion `error` string on hook for user-friendly message.
 */
export interface ResumeTailorErrorResponse {
	status: 'error'
	/** Always empty — no edits on error. */
	edits: []
	appliedMode: null
}

/**
 * Discriminated union of all possible tailor outcomes.
 * Hook returns: ResumeTailorResponse (success) | ResumeTailorErrorResponse (error)
 */
export type ResumeTailorNormalizedResponse = ResumeTailorResponse | ResumeTailorErrorResponse
