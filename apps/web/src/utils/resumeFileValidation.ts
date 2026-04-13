import {
  RESUME_UPLOAD_CONSTRAINTS,
  type ResumeAllowedExtension,
  type ResumeParseErrorCode,
} from '@uncooked/shared'

export type ResumeFileValidationSuccess = {
  ok: true
  extension: ResumeAllowedExtension
}

export type ResumeFileValidationFailure = {
  ok: false
  errorCode: ResumeParseErrorCode
  message: string
}

export type ResumeFileValidationResult = ResumeFileValidationSuccess | ResumeFileValidationFailure

const extensionSet = new Set<string>(RESUME_UPLOAD_CONSTRAINTS.allowedExtensions)
const mimeTypeSet = new Set<string>(RESUME_UPLOAD_CONSTRAINTS.allowedMimeTypes)

const getExtension = (fileName: string): string => {
  const parts = fileName.toLowerCase().split('.')
  return parts.length > 1 ? parts[parts.length - 1] : ''
}

export function validateResumeFile(file: File): ResumeFileValidationResult {
  const extension = getExtension(file.name)

  if (!extension || !extensionSet.has(extension)) {
    return {
      ok: false,
      errorCode: 'unsupported_format',
      message: 'Unsupported resume format. Please upload a PDF file.',
    }
  }

  const typedExtension = extension as ResumeAllowedExtension

  if (file.size <= 0) {
    return {
      ok: false,
      errorCode: 'invalid_file',
      message: 'The selected file is empty. Please choose a valid resume file.',
    }
  }

  if (file.size > RESUME_UPLOAD_CONSTRAINTS.maxBytes) {
    return {
      ok: false,
      errorCode: 'file_too_large',
      message: 'File is too large. Maximum allowed size is 5 MB.',
    }
  }

  if (file.type && !mimeTypeSet.has(file.type)) {
    return {
      ok: false,
      errorCode: 'unsupported_format',
      message: 'Unsupported MIME type for resume upload. Please use a PDF file.',
    }
  }

  return {
    ok: true,
    extension: typedExtension,
  }
}
