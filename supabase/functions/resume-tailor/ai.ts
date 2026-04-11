import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

declare const Deno: {
  env: {
    get: (key: string) => string | undefined
  }
}

export type ResumeTailorPayload = {
  jobDescription: string
  resumeContent: Record<string, unknown>
  mode?: 'delta_only'
}

export type ResumeTailorEdit = {
  section: 'summary' | 'experience' | 'skills'
  targetId: string
  operation: 'replace' | 'insert' | 'remove'
  replacement: string
  reason?: string
}

export type ResumeTailorMode = 'delta_only'

export type ResumeTailorResult = {
  edits?: ResumeTailorEdit[]
  appliedMode?: ResumeTailorMode
  isPartial?: boolean
}

type ParseFailureReason =
  | 'no_candidates'
  | 'safety_filtered'
  | 'truncated'
  | 'missing_content'
  | 'missing_text'
  | 'invalid_json'
  | 'invalid_shape'

type ParseGeminiResult =
  | { ok: true; value: ResumeTailorResult }
  | { ok: false; reason: ParseFailureReason; details?: string }

const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
const MAX_RETRIES = 2
const TIMEOUT_MS = 25_000
const DELTA_ONLY_BASE_OUTPUT_TOKENS = 4000
const DELTA_ONLY_MAX_OUTPUT_TOKENS = 8000
const ALLOWED_EDIT_SECTIONS = new Set<ResumeTailorEdit['section']>(['summary', 'experience', 'skills'])
const MAX_EXPERIENCE_ENTRIES = 5
const MAX_BULLETS_PER_EXPERIENCE = 4
const MAX_SKILL_ITEMS = 20
const DEBUG_ENABLED = Deno.env.get('RESUME_TAILOR_DEBUG') === 'true'
const DEBUG_VERBOSE = Deno.env.get('RESUME_TAILOR_DEBUG_VERBOSE') === 'true'
const DEBUG_PREVIEW_CHARS = 1800

type TailorRunOptions = {
  requestId?: string
}

type ResumeTextNode = { id: string; text: string }

const toDebugPreview = (value: unknown, maxChars = DEBUG_PREVIEW_CHARS): string => {
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    if (serialized.length <= maxChars) return serialized
    return `${serialized.slice(0, maxChars)}... [truncated ${serialized.length - maxChars} chars]`
  } catch {
    return '[unserializable]'
  }
}

const debugLog = (requestId: string | undefined, event: string, data?: Record<string, unknown>) => {
  if (!DEBUG_ENABLED) return

  console.log('resume-tailor.ai', {
    requestId,
    event,
    ...data,
  })
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const asTextNode = (value: unknown): ResumeTextNode | null => {
  if (!isRecord(value)) return null

  const id = typeof value.id === 'string' ? value.id.trim() : ''
  const text = typeof value.text === 'string' ? value.text.trim() : ''
  if (!id || !text) return null

  return { id, text }
}

const collectIds = (value: unknown, out: string[] = []): string[] => {
  if (Array.isArray(value)) {
    for (const item of value) collectIds(item, out)
    return out
  }

  if (!isRecord(value)) return out

  const id = typeof value.id === 'string' ? value.id.trim() : ''
  if (id) out.push(id)

  for (const nested of Object.values(value)) collectIds(nested, out)
  return out
}

const buildLeanResumeContext = (resumeContent: Record<string, unknown>) => {
  const summary = asTextNode(resumeContent.summary)

  const skills = Array.isArray(resumeContent.skills)
    ? resumeContent.skills.map(asTextNode).filter((item): item is ResumeTextNode => item !== null)
    : []

  const experience = Array.isArray(resumeContent.experience)
    ? resumeContent.experience
        .slice(0, MAX_EXPERIENCE_ENTRIES)
        .map((rawEntry) => {
          if (!isRecord(rawEntry)) return null

          const id = typeof rawEntry.id === 'string' ? rawEntry.id.trim() : ''
          const title = asTextNode(rawEntry.title)
          const company = asTextNode(rawEntry.company)
          const bullets = Array.isArray(rawEntry.bullets)
            ? rawEntry.bullets
                .slice(0, MAX_BULLETS_PER_EXPERIENCE)
                .map(asTextNode)
                .filter((item): item is ResumeTextNode => item !== null)
            : []

          if (!id || !title || !company || bullets.length === 0) return null

          return {
            id,
            title,
            company,
            bullets,
          }
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    : []

  return {
    summary,
    skills: skills.slice(0, MAX_SKILL_ITEMS),
    experience,
  }
}

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  required: ['edits'],
  properties: {
    edits: {
      type: 'ARRAY',
      minItems: 1,
      maxItems: 5,
      items: {
        type: 'OBJECT',
        required: ['section', 'targetId', 'operation', 'replacement'],
        properties: {
          section: {
            type: 'STRING',
            enum: ['summary', 'experience', 'skills'],
          },
          targetId: { type: 'STRING' },
          operation: {
            type: 'STRING',
            enum: ['replace', 'insert', 'remove'],
          },
          replacement: { type: 'STRING' },
        },
      },
    },
  },
} as const

const buildPrompt = (payload: ResumeTailorPayload): string => {
  // Keep the context compact to reduce token pressure and truncation risk.
  const leanResume = buildLeanResumeContext(payload.resumeContent)
  const resumeText = JSON.stringify(leanResume)
  const validTargetIds = JSON.stringify(collectIds(leanResume))

  return `You are a resume tailoring engine that outputs minimal edit deltas.

TASK:
Return only the highest-impact changes to align the resume with the job description.

RULES:
- Return valid JSON only.
- Do not include reasoning, commentary, notes, markdown, code fences, or extra keys.
- Do not return the full resume.
- Return changed content only.
- Preserve original facts and chronology.
- Do not invent metrics, tools, experiences, achievements, or credentials.
- Focus only on summary, skills, and selected experience bullets.
- Return 2-5 edits total.
- Keep replacement text concise and directly usable.

EDIT TARGETS:
- section: one of summary|experience|skills
- operation: replace|insert|remove
- targetId: MUST be one of VALID_TARGET_IDS (never create new ids)

JOB DESCRIPTION:
${payload.jobDescription}

CURRENT RESUME (trimmed context):
${resumeText}

VALID_TARGET_IDS:
${validTargetIds}

OUTPUT (strict JSON only):
{
  "edits": [
    {
      "section": "experience",
      "targetId": "experience_e1_bullet_1",
      "operation": "replace",
      "replacement": "Improved bullet text aligned to job keywords"
    }
  ]
}`
}

const cleanModelText = (text: string): string =>
  text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

const extractFirstJsonObject = (text: string): string | null => {
  const start = text.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let isEscaped = false

  for (let i = start; i < text.length; i++) {
    const ch = text[i]

    if (isEscaped) {
      isEscaped = false
      continue
    }

    if (ch === '\\') {
      isEscaped = true
      continue
    }

    if (ch === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (ch === '{') depth++
    if (ch === '}') depth--

    if (depth === 0) {
      return text.slice(start, i + 1)
    }
  }

  return null
}

const parseJsonObject = (text: string): unknown | null => {
  const cleaned = cleanModelText(text)

  try {
    return JSON.parse(cleaned)
  } catch {
    const extracted = extractFirstJsonObject(cleaned)
    if (!extracted) return null

    try {
      return JSON.parse(extracted)
    } catch {
      return null
    }
  }
}

const parseEdits = (value: unknown): ResumeTailorEdit[] | null => {
  if (!Array.isArray(value)) return null

  const edits: ResumeTailorEdit[] = []
  const sectionValues: ResumeTailorEdit['section'][] = ['summary', 'experience', 'skills']

  for (const rawEdit of value) {
    if (!rawEdit || typeof rawEdit !== 'object') continue

    const edit = rawEdit as Record<string, unknown>
    const rawSection = typeof edit.section === 'string' ? edit.section.trim() : ''
    const section = sectionValues.find((candidate) => candidate === rawSection)
    const targetId = typeof edit.targetId === 'string' ? edit.targetId.trim() : ''
    const operation =
      edit.operation === 'replace' || edit.operation === 'insert' || edit.operation === 'remove'
        ? edit.operation
        : null
    const replacement = typeof edit.replacement === 'string' ? edit.replacement.trim() : ''
    const reason = typeof edit.reason === 'string' ? edit.reason.trim() : undefined

    if (!section || !targetId || !operation || !replacement) continue
    if (!ALLOWED_EDIT_SECTIONS.has(section)) continue
    edits.push({ section, targetId, operation, replacement, reason })
  }

  return edits.length > 0 ? edits : null
}

const parseGeminiResponse = (response: unknown): ParseGeminiResult => {
  if (!response || typeof response !== 'object') {
    return { ok: false, reason: 'invalid_shape', details: 'Response was not an object' }
  }

  const candidates = (response as { candidates?: unknown[] }).candidates
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return { ok: false, reason: 'no_candidates' }
  }

  const firstCandidate = candidates[0]
  if (!firstCandidate || typeof firstCandidate !== 'object') {
    return { ok: false, reason: 'invalid_shape', details: 'First candidate missing or invalid' }
  }

  const finishReason = (firstCandidate as { finishReason?: unknown }).finishReason
  if (finishReason === 'SAFETY') {
    return { ok: false, reason: 'safety_filtered' }
  }
  if (finishReason === 'MAX_TOKENS') {
    return { ok: false, reason: 'truncated' }
  }

  const content = (firstCandidate as { content?: unknown }).content
  if (!content || typeof content !== 'object') {
    return { ok: false, reason: 'missing_content' }
  }

  const parts = (content as { parts?: unknown[] }).parts
  if (!Array.isArray(parts) || parts.length === 0) {
    return { ok: false, reason: 'missing_content', details: 'Content parts missing or empty' }
  }

  const text = parts
    .map((part) => (part as { text?: unknown }).text)
    .filter((value): value is string => typeof value === 'string')
    .join('\n')

  if (!text) {
    return { ok: false, reason: 'missing_text', details: 'No text field found in content parts' }
  }

  const parsed = parseJsonObject(text)

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, reason: 'invalid_json' }
  }

  const result = parsed as {
    edits?: unknown
  }

  const edits = parseEdits(result.edits)

  if (!edits) {
    return {
      ok: false,
      reason: 'invalid_shape',
      details: 'delta_only mode requires edits[]',
    }
  }

  return {
    ok: true,
    value: {
      edits,
    },
  }
}

const getGenerationConfig = (attempt: number) => ({
  temperature: 0.1,
  maxOutputTokens: Math.min(
    DELTA_ONLY_BASE_OUTPUT_TOKENS + attempt * 300,
    DELTA_ONLY_MAX_OUTPUT_TOKENS
  ),
})

const runTailor = async (
  payload: ResumeTailorPayload,
  options?: TailorRunOptions
): Promise<ResumeTailorResult> => {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY environment variable')
  }

  const requestId = options?.requestId
  const prompt = buildPrompt(payload)
  let lastError: Error | null = null

  debugLog(requestId, 'start', {
    model: GEMINI_MODEL,
    retries: MAX_RETRIES,
    timeoutMs: TIMEOUT_MS,
    promptChars: prompt.length,
    payloadJobDescriptionChars: payload.jobDescription.length,
    payloadResumeChars: JSON.stringify(payload.resumeContent).length,
    promptPreview: DEBUG_VERBOSE ? toDebugPreview(prompt) : undefined,
  })

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const generationConfig = getGenerationConfig(attempt)

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        ...generationConfig,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    }

    debugLog(requestId, 'llm_request', {
      attempt,
      generationConfig,
      requestBodyPreview: DEBUG_VERBOSE ? toDebugPreview(requestBody) : undefined,
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const response = await fetch(`${GEMINI_API_ENDPOINT}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        debugLog(requestId, 'llm_http_error', {
          attempt,
          status: response.status,
          bodyPreview: toDebugPreview(errorText),
        })
        throw new Error(`Gemini API error (${response.status}): ${errorText}`)
      }

      const data = await response.json()
      debugLog(requestId, 'llm_response', {
        attempt,
        finishReason:
          (data as { candidates?: Array<{ finishReason?: string }> })?.candidates?.[0]?.finishReason ??
          'unknown',
        responsePreview: DEBUG_VERBOSE ? toDebugPreview(data) : undefined,
      })

      const parsed = parseGeminiResponse(data)

      if (!parsed.ok) {
        const failureMessage =
          parsed.details !== undefined
            ? `Failed to parse Gemini response [${parsed.reason}]: ${parsed.details}`
            : `Failed to parse Gemini response [${parsed.reason}]`

        console.error('resume-tailor parse failure', {
          reason: parsed.reason,
          details: parsed.details,
          attempt,
          maxOutputTokens: generationConfig.maxOutputTokens,
        })

        debugLog(requestId, 'parse_failure', {
          attempt,
          reason: parsed.reason,
          details: parsed.details,
        })

        throw new Error(failureMessage)
      }

      debugLog(requestId, 'parse_success', {
        attempt,
        editCount: parsed.value.edits?.length ?? 0,
        resultPreview: DEBUG_VERBOSE ? toDebugPreview(parsed.value) : undefined,
      })

      return parsed.value
    } catch (error) {
      clearTimeout(timeoutId)
      lastError = error instanceof Error ? error : new Error(String(error))

      const message = lastError.message.toLowerCase()
      const shouldRetry =
        !message.includes('resource_exhausted') &&
        !message.includes('gemini api error (429)') &&
        (!message.includes('failed to parse') || message.includes('[truncated]'))

      debugLog(requestId, 'attempt_failed', {
        attempt,
        message: lastError.message,
        shouldRetry,
      })

      if (attempt < MAX_RETRIES && shouldRetry) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
        continue
      }
    }
  }

  debugLog(requestId, 'failed_all_attempts', {
    message: lastError?.message,
  })

  throw lastError || new Error('AI request failed after retries')
}

export const tailorResumeWithAI = async (
  payload: ResumeTailorPayload,
  options?: TailorRunOptions
): Promise<ResumeTailorResult> => {
  const result = await runTailor(payload, options)
  return {
    ...result,
    appliedMode: 'delta_only',
    isPartial: false,
  }
}
