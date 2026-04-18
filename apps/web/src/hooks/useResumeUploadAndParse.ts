import { useCallback, useState } from 'react'
import { uploadResumeFile } from '@/lib/resumeRepository'
import type { ResumeRecordDto } from '@/types'
import { parsePdfToTailorContent } from '@/lib/openResumeParser/parsePdfToTailorContent'
import { validateResumeFile } from '@/utils/resumeFileValidation'
import { useResumePersistence } from '@/hooks/useResumePersistence'
import { useTrackActivity } from '@/hooks/useTrackActivity'

export type ResumeUploadPhase =
  | 'idle'
  | 'validating'
  | 'uploading'
  | 'parsing'
  | 'saving'
  | 'success'
  | 'error'

export type UploadAndParseParams = {
  userId: string
  file: File
  title?: string
  isPrimary?: boolean
}

type UseResumeUploadAndParseReturn = {
  phase: ResumeUploadPhase
  isLoading: boolean
  error: string | null
  clearError: () => void
  uploadAndParse: (params: UploadAndParseParams) => Promise<ResumeRecordDto | null>
}

export function useResumeUploadAndParse(): UseResumeUploadAndParseReturn {
  const [phase, setPhase] = useState<ResumeUploadPhase>('idle')
  const [error, setError] = useState<string | null>(null)

  const { createResumeFromParse } = useResumePersistence()
  const { trackEvent } = useTrackActivity('resume')

  const clearError = useCallback(() => {
    setError(null)
    if (phase === 'error') setPhase('idle')
  }, [phase])

  const uploadAndParse = useCallback(
    async (params: UploadAndParseParams): Promise<ResumeRecordDto | null> => {
      setError(null)

      setPhase('validating')
      const validation = validateResumeFile(params.file)
      if (!validation.ok) {
        setPhase('error')
        setError(validation.message)
        return null
      }

      setPhase('uploading')
      let uploaded
      try {
        uploaded = await uploadResumeFile(params.file, params.userId)
      } catch (err) {
        setPhase('error')
        setError(err instanceof Error ? err.message : 'Failed to upload resume file.')
        return null
      }

      setPhase('parsing')
      const parseResult = await parsePdfToTailorContent(params.file)
      if (!parseResult.structuredContent) {
        setPhase('error')
        setError(parseResult.errorMessage ?? 'Failed to parse resume.')
        return null
      }

      trackEvent('edit_committed', {
        source: 'upload_parse',
        parseStatus: parseResult.status,
      })

      setPhase('saving')
      try {
        const saved = await createResumeFromParse({
          userId: params.userId,
          title: params.title,
          structuredContent: parseResult.structuredContent,
          filePath: uploaded.storagePath,
          fileName: uploaded.fileName,
          fileMimeType: uploaded.mimeType,
          fileSize: uploaded.fileSize,
          isPrimary: params.isPrimary ?? true,
          status: parseResult.status,
        })

        trackEvent('version_created', {
          source: 'upload_parse',
          parseStatus: parseResult.status,
        })

        setPhase('success')
        return saved
      } catch (err) {
        setPhase('error')
        setError(err instanceof Error ? err.message : 'Parsed resume could not be saved.')
        return null
      }
    },
    [createResumeFromParse, trackEvent]
  )

  return {
    phase,
    isLoading: phase !== 'idle' && phase !== 'success' && phase !== 'error',
    error,
    clearError,
    uploadAndParse,
  }
}
