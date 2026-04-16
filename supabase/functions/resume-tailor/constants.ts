export const MAX_BODY_BYTES = 120_000
export const MIN_JOB_DESCRIPTION_CHARS = 200
export const MAX_JOB_DESCRIPTION_CHARS = 12_000
export const MAX_RESUME_OBJECT_CHARS = 45_000

export const MAX_RETRIES = 2
export const TIMEOUT_MS = 35_000
export const DELTA_ONLY_BASE_OUTPUT_TOKENS = 6000
export const DELTA_ONLY_MAX_OUTPUT_TOKENS = 12_000

export const MAX_EXPERIENCE_ENTRIES = 5
export const MAX_BULLETS_PER_EXPERIENCE = 4
export const MAX_SKILL_ITEMS = 20
export const MAX_EDITS = 5

export const GEMINI_MODEL = 'gemini-2.5-flash'
export const GEMINI_API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
