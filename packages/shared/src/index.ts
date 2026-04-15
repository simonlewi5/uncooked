// Shared types and utilities
// Organized by feature domain for clarity and maintainability

export type { Database } from './types/database'

// ── Resume Document: Core data model ────────────────────────────────────────
export type {
	ResumeDocument,
	ResumeDocumentField,
	ResumeDocumentEducationEntry,
	ResumeDocumentExperienceEntry,
} from './types/resumeDocument'

// ── Resume Tailor: AI suggestion API ──────────────────────────────────────────
export type {
	ResumeTailorRequest,
	ResumeTailorResponse,
	ResumeTailorEdit,
	ResumeTailorMode,
	ResumeTailorEditSection,
} from './types/resumeTailor'

// ── Resume Tailor Normalized: Hook's consumer contract ───────────────────────
export type {
	ResumeTailorNormalizedResponse,
	ResumeTailorSuccessResponse,
	ResumeTailorSuccessEmptyResponse,
	ResumeTailorPartialResponse,
	ResumeTailorErrorResponse,
} from './types/resumeTailorNormalized'

// ── Resume Parse: File parsing API ────────────────────────────────────────────
export type {
	ResumeParseResponse,
	ResumeParseStatus,
	ResumeParseErrorCode,
	ResumeParseWarning,
} from './types/resumeParse'

// ── Resume Upload: File validation & constraints ─────────────────────────────
export {
	RESUME_UPLOAD_MAX_BYTES,
	RESUME_ALLOWED_EXTENSIONS,
	RESUME_ALLOWED_MIME_TYPES,
	RESUME_UPLOAD_CONSTRAINTS,
} from './types/resumeUpload'

export type {
	ResumeUploadConstraints,
	ResumeAllowedExtension,
	ResumeAllowedMimeType,
} from './types/resumeUpload'

// ── Resume Record: Database DTOs ──────────────────────────────────────────────
export type {
	ResumeRecordDto,
	ResumeRecordStatus,
} from './types/resumeRecord'

