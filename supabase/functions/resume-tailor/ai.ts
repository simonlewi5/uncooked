import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

declare const Deno: {
  env: {
    get: (key: string) => string | undefined
  }
}

export type ResumeTailorPayload = {
  jobDescription: string
  resumeContent: string | Record<string, unknown>
  skills?: string[]
  mode?: 'suggestions_only' | 'full_rewrite'
}

export type ResumeTailorResult = {
  tailoredResume: string
  suggestions: string[]
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
const TIMEOUT_MS = 60_000
const SUGGESTIONS_ONLY_BASE_OUTPUT_TOKENS = 2200
const SUGGESTIONS_ONLY_MAX_OUTPUT_TOKENS = 3400

const getMode = (mode: ResumeTailorPayload['mode']) =>
  mode === 'suggestions_only' ? 'suggestions_only' : 'full_rewrite'

const buildPrompt = (payload: ResumeTailorPayload): string => {
  const mode = getMode(payload.mode)
  let resumeText = ''
  if (typeof payload.resumeContent === 'string') {
    resumeText = payload.resumeContent
  } else {
    try {
      resumeText = JSON.stringify(payload.resumeContent, null, 2)
    } catch {
      resumeText = String(payload.resumeContent)
    }
  }

  const skillsSection = payload.skills?.length
    ? `\n\nUser-specified skills to emphasize:\n${payload.skills.join(', ')}`
    : ''

  const outputFormat =
    mode === 'suggestions_only'
      ? `{
  "tailoredResume": "",
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]
}`
      : `{
  "tailoredResume": "full rewritten resume text with STAR bullets and job-relevant keywords",
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]
}`

  const modeInstruction =
    mode === 'suggestions_only'
      ? `MODE: suggestions_only
- Return concise, high-impact suggestions only.
- Keep "tailoredResume" as an empty string.
- Suggestion count: 5 to 8.
- Prioritize fastest useful feedback over exhaustive rewrite.`
      : `MODE: full_rewrite
- Return a complete tailored resume in "tailoredResume".
- Suggestion count: 3 to 6.`

  return `You are an expert resume writer specializing in STAR-format bullet points and ATS optimization.

CRITICAL INSTRUCTIONS:
- Do NOT invent companies, dates, metrics, degrees, or any factual information
- ONLY rewrite and reframe existing content
- Use STAR format (Situation/Task, Action, Result) for experience bullets
- If metrics are missing, use qualitative results without fabricating numbers
- Emphasize skills and keywords from the job description
- Keep section structure intact
- Be concise and professional

${modeInstruction}

JOB DESCRIPTION:
${payload.jobDescription}
${skillsSection}

CURRENT RESUME:
${resumeText}

OUTPUT FORMAT (strict JSON):
${outputFormat}

Return ONLY valid JSON. No markdown, no code blocks, no explanations.`
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

const parseSuggestions = (value: unknown): string[] | null => {
  if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
    const normalized = value.map((item) => item.trim()).filter(Boolean)
    return normalized.length > 0 ? normalized : null
  }

  if (typeof value === 'string') {
    const normalized = value
      .split(/\r?\n/)
      .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
      .filter(Boolean)
    return normalized.length > 0 ? normalized : null
  }

  return null
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
    tailoredResume?: unknown
    suggestions?: unknown
    recommendations?: unknown
  }

  const tailoredResume = typeof result.tailoredResume === 'string' ? result.tailoredResume : ''
  const suggestions = parseSuggestions(result.suggestions) ?? parseSuggestions(result.recommendations)

  if (!suggestions) {
    return {
      ok: false,
      reason: 'invalid_shape',
      details: 'Missing string[] suggestions/recommendations in parsed JSON',
    }
  }

  return {
    ok: true,
    value: {
      tailoredResume,
      suggestions,
    },
  }
}

export const tailorResumeWithAI = async (
  payload: ResumeTailorPayload
): Promise<ResumeTailorResult> => {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY environment variable')
  }

  const prompt = buildPrompt(payload)
  const mode = getMode(payload.mode)

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const maxOutputTokens =
      mode === 'suggestions_only'
        ? Math.min(
            SUGGESTIONS_ONLY_BASE_OUTPUT_TOKENS + attempt * 600,
            SUGGESTIONS_ONLY_MAX_OUTPUT_TOKENS
          )
        : 4096

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
        temperature: mode === 'suggestions_only' ? 0.4 : 0.7,
        maxOutputTokens,
        responseMimeType: 'application/json',
      },
    }

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
        throw new Error(`Gemini API error (${response.status}): ${errorText}`)
      }

      const data = await response.json()
      const parsed = parseGeminiResponse(data)

      if (!parsed.ok) {
        const failureMessage =
          parsed.details !== undefined
            ? `Failed to parse Gemini response [${parsed.reason}]: ${parsed.details}`
            : `Failed to parse Gemini response [${parsed.reason}]`

        console.error('resume-tailor parse failure', {
          reason: parsed.reason,
          details: parsed.details,
          mode,
          attempt,
          maxOutputTokens,
        })

        throw new Error(failureMessage)
      }

      return parsed.value
    } catch (error) {
      clearTimeout(timeoutId)
      lastError = error instanceof Error ? error : new Error(String(error))

      const message = lastError.message.toLowerCase()
      const shouldRetry =
        !message.includes('resource_exhausted') &&
        !message.includes('gemini api error (429)') &&
        (!message.includes('failed to parse') || message.includes('[truncated]'))

      if (attempt < MAX_RETRIES && shouldRetry) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
        continue
      }
    }
  }

  throw lastError || new Error('AI request failed after retries')
}
