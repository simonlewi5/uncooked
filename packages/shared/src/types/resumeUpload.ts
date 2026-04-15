/** Resume file upload constraints and validation types. */

export const RESUME_UPLOAD_MAX_BYTES = 5 * 1024 * 1024

export const RESUME_ALLOWED_EXTENSIONS = ['pdf'] as const
export type ResumeAllowedExtension = (typeof RESUME_ALLOWED_EXTENSIONS)[number]

export const RESUME_ALLOWED_MIME_TYPES = ['application/pdf'] as const
export type ResumeAllowedMimeType = (typeof RESUME_ALLOWED_MIME_TYPES)[number]

export interface ResumeUploadConstraints {
	maxBytes: number
	allowedExtensions: readonly ResumeAllowedExtension[]
	allowedMimeTypes: readonly ResumeAllowedMimeType[]
}

export const RESUME_UPLOAD_CONSTRAINTS: ResumeUploadConstraints = {
	maxBytes: RESUME_UPLOAD_MAX_BYTES,
	allowedExtensions: RESUME_ALLOWED_EXTENSIONS,
	allowedMimeTypes: RESUME_ALLOWED_MIME_TYPES,
}
