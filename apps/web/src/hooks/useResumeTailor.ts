import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ResumeTailorRequest, ResumeTailorResponse } from '@/types'

type UseResumeTailorReturn = {
  runTailor: (payload: ResumeTailorRequest) => Promise<ResumeTailorResponse>
  isLoading: boolean
  error: string | null
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

export function useResumeTailor(): UseResumeTailorReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const runTailor = useCallback(async (payload: ResumeTailorRequest) => {
    setIsLoading(true)
    setError(null)

    try {
      const invokeTailor = async () =>
        supabase.functions.invoke<ResumeTailorResponse>('resume-tailor', {
          body: payload,
        })

      let { data, error } = await invokeTailor()

      const message = error?.message ?? ''
      if (error && /invalid jwt/i.test(message)) {
        const { error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError) throw refreshError
        const retry = await invokeTailor()
        data = retry.data
        error = retry.error
      }

      if (error) throw error
      if (!data) {
        throw new Error('resume-tailor returned no data')
      }

      return data
    } catch (caughtError) {
      const friendlyMessage = await mapErrorMessage(caughtError)
      setError(friendlyMessage)
      throw caughtError
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { runTailor, isLoading, error, clearError }
}