import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ResumeTailorRequest, ResumeTailorResponse, ResumeTailorNormalizedResponse } from '@/types'

const DEBUG_ENABLED = import.meta.env.VITE_RESUME_TAILOR_DEBUG === 'true'
const DEBUG_VERBOSE = import.meta.env.VITE_RESUME_TAILOR_DEBUG_VERBOSE === 'true'

const toDebugPreview = (value: unknown, maxChars = 1200): string => {
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    if (serialized.length <= maxChars) return serialized
    return `${serialized.slice(0, maxChars)}... [truncated ${serialized.length - maxChars} chars]`
  } catch {
    return '[unserializable]'
  }
}

const debugLog = (event: string, data?: Record<string, unknown>) => {
  if (!DEBUG_ENABLED) return
  console.log('resume-tailor.client', {
    event,
    ...data,
  })
}

type UseResumeTailorReturn = {
  /**
   * Execute a tailor request and return normalized result.
   * Always resolves to a ResumeTailorNormalizedResponse (never throws).
   * All error handling, partial detection, and message mapping is done here.
   */
  runTailor: (payload: ResumeTailorRequest) => Promise<ResumeTailorNormalizedResponse>
  /** True while the tailor request is in flight. */
  isLoading: boolean
  /** Null if no pending tailor. Set when runTailor() encounters an error. Cleared by clearing page error or calling clearError(). */
  error: string | null
  /** Clear the current error message. */
  clearError: () => void
}

type ErrorWithContext = {
  message?: string
  context?: Response
}

type ErrorBody = {
  error?: string
  details?: string
}

/**
 * Map network or API errors to user-friendly messages.
 * Handles all failure modes: network errors, HTTP status codes (401, 400, 429, 502, etc), and response parsing errors.
 * Returns a fallback message if the error cannot be parsed.
 */
async function mapErrorMessage(error: unknown): Promise<string> {
  const fallback = 'Unable to tailor resume right now. Please try again.'

  if (!error || typeof error !== 'object') return fallback

  const maybeError = error as ErrorWithContext
  const response = maybeError.context

  if (!response) {
    return maybeError.message ?? fallback
  }

  let details = ''
  try {
    const body = (await response.clone().json()) as ErrorBody
    details = body.details ?? body.error ?? ''
  } catch {
    details = ''
  }

  if (response.status === 400) {
    return details || 'Validation failed. Check the job description and resume content.'
  }

  if (response.status === 429) {
    return details || 'AI service is rate limited. Please wait a bit and try again.'
  }

  if (response.status === 401) {
    return 'You must be signed in to tailor your resume.'
  }

  if (response.status === 413) {
    return details || 'Payload is too large. Shorten resume or job description.'
  }

  if (response.status === 405) {
    return details || 'Resume tailor endpoint requires POST. Please retry from the Auto-Tailor button.'
  }

  if (response.status === 502) {
    return details || 'AI service is currently unavailable. Please retry.'
  }

  if (response.status >= 500) {
    return details || 'Server error while tailoring your resume.'
  }

  return details || maybeError.message || fallback
}

/** Determine if an error is retryable (transient) or permanent. */
function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return true // Unknown errors: retry

  const maybeError = error as ErrorWithContext
  const response = maybeError.context

  if (!response) {
    // Network errors are retryable
    return true
  }

  // Permanent errors: auth, validation, method not allowed
  if (response.status === 401 || response.status === 400 || response.status === 405) {
    return false
  }

  // Transient errors: rate limit, server errors
  if (response.status === 429 || response.status === 413 || response.status >= 500) {
    return true
  }

  return true // Default to retryable
}

/**
 * Normalize raw backend response and hook state to a single unified response type.
 * This is the single source of truth for interpreting all tailor outcomes.
 */
function normalizeBackendResponse(
  backendResponse: ResumeTailorResponse | null,
  error: unknown | null,
  errorMessage: string | null
): ResumeTailorNormalizedResponse {
  // Error case: always comes first
  if (error || errorMessage) {
    const message = errorMessage || 'Unable to tailor resume right now. Please try again.'
    return {
      status: 'error',
      edits: [],
      editCount: 0,
      appliedMode: null,
      retryable: isRetryableError(error),
      messages: {
        error: message,
        warning: null,
      },
    }
  }

  // No response from backend
  if (!backendResponse) {
    return {
      status: 'error',
      edits: [],
      editCount: 0,
      appliedMode: null,
      retryable: true,
      messages: {
        error: 'No response from AI service. Please retry.',
        warning: null,
      },
    }
  }

  // Partial response (AI truncated or fallback)
  const edits = backendResponse.edits ?? []
  if (backendResponse.isPartial) {
    return {
      status: 'partial',
      edits,
      editCount: edits.length,
      appliedMode: backendResponse.appliedMode || 'delta_only',
      retryable: true,
      messages: {
        error: null,
        warning: 'AI response was incomplete. Review the suggestions below or try again to get more edits.',
      },
    }
  }

  // Complete success
  if (edits.length === 0) {
    return {
      status: 'success_empty',
      edits: [],
      editCount: 0,
      appliedMode: backendResponse.appliedMode || 'delta_only',
      retryable: false,
      messages: {
        error: null,
        warning: null,
      },
    }
  }

  return {
    status: 'success',
    edits,
    editCount: edits.length,
    appliedMode: backendResponse.appliedMode || 'delta_only',
    retryable: false,
    messages: {
      error: null,
      warning: null,
    },
  }
}

export function useResumeTailor(): UseResumeTailorReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const runTailor = useCallback(async (payload: ResumeTailorRequest) => {
    setIsLoading(true)
    setError(null)

    const clientRequestId = Math.random().toString(36).slice(2, 10)
    debugLog('request_start', {
      clientRequestId,
      mode: payload.mode ?? 'delta_only',
      jobDescriptionChars: payload.jobDescription.length,
      resumeObjectChars: JSON.stringify(payload.resumeContent).length,
      payloadPreview: DEBUG_VERBOSE ? toDebugPreview(payload) : undefined,
    })

    let result: ResumeTailorNormalizedResponse
    try {
      const invokeTailor = async () =>
        supabase.functions.invoke<ResumeTailorResponse>('resume-tailor', {
          body: payload,
        })

      let { data, error } = await invokeTailor()

      debugLog('request_result', {
        clientRequestId,
        hasData: Boolean(data),
        hasError: Boolean(error),
        errorMessage: error?.message,
        dataPreview: DEBUG_VERBOSE ? toDebugPreview(data) : undefined,
      })

      const message = error?.message ?? ''
      if (error && /invalid jwt/i.test(message)) {
        debugLog('jwt_refresh_attempt', { clientRequestId })
        const { error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError) throw refreshError
        const retry = await invokeTailor()
        data = retry.data
        error = retry.error
        debugLog('jwt_refresh_result', {
          clientRequestId,
          hasData: Boolean(data),
          hasError: Boolean(error),
          errorMessage: error?.message,
          dataPreview: DEBUG_VERBOSE ? toDebugPreview(data) : undefined,
        })
      }

      if (error) throw error
      if (!data) {
        throw new Error('resume-tailor returned no data')
      }

      debugLog('request_success', {
        clientRequestId,
        editCount: data.edits?.length ?? 0,
        isPartial: data.isPartial ?? false,
      })

      // Normalize successful response
      result = normalizeBackendResponse(data, null, null)
    } catch (caughtError) {
      const friendlyMessage = await mapErrorMessage(caughtError)
      setError(friendlyMessage)
      debugLog('request_failed', {
        clientRequestId,
        errorMessage: caughtError instanceof Error ? caughtError.message : String(caughtError),
        friendlyMessage,
      })

      // Normalize error response
      result = normalizeBackendResponse(null, caughtError, friendlyMessage)
    } finally {
      setIsLoading(false)
    }

    return result
  }, [])

  return { runTailor, isLoading, error, clearError }
}