import { useCallback, useState } from 'react'
import type { ResumeDocument, ResumeRecordDto, ResumeRecordStatus } from '@/types'
import {
  createParsedResume,
  getPrimaryResume,
  saveResumeStructuredContent,
} from '@/lib/resumeRepository'

type CreateParsedResumeParams = {
  userId: string
  title?: string
  structuredContent: ResumeDocument
  filePath: string
  fileName: string
  fileMimeType: string
  fileSize: number
  isPrimary?: boolean
  status?: ResumeRecordStatus
}

type UseResumePersistenceReturn = {
  isLoading: boolean
  error: string | null
  clearError: () => void
  loadPrimaryResume: (userId: string) => Promise<ResumeRecordDto | null>
  createResumeFromParse: (input: CreateParsedResumeParams) => Promise<ResumeRecordDto>
  saveResume: (
    resumeId: string,
    structuredContent: ResumeDocument,
    status?: ResumeRecordStatus
  ) => Promise<ResumeRecordDto>
}

const toErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export function useResumePersistence(): UseResumePersistenceReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const loadPrimaryResume = useCallback(async (userId: string) => {
    setIsLoading(true)
    setError(null)
    try {
      return await getPrimaryResume(userId)
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to load resume.'))
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const createResumeFromParse = useCallback(async (input: CreateParsedResumeParams) => {
    setIsLoading(true)
    setError(null)
    try {
      return await createParsedResume(input)
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to save parsed resume.'))
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const saveResume = useCallback(
    async (
      resumeId: string,
      structuredContent: ResumeDocument,
      status: ResumeRecordStatus = 'edited'
    ) => {
      setIsLoading(true)
      setError(null)
      try {
        return await saveResumeStructuredContent(resumeId, structuredContent, status)
      } catch (err) {
        setError(toErrorMessage(err, 'Failed to save resume changes.'))
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  return {
    isLoading,
    error,
    clearError,
    loadPrimaryResume,
    createResumeFromParse,
    saveResume,
  }
}
