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
}

export type ResumeTailorResult = {
  tailoredResume: string
  suggestions: string[]
}

const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash'
const GEMINI_API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
const MAX_RETRIES = 2
const TIMEOUT_MS = 60_000

const buildPrompt = (payload: ResumeTailorPayload): string => {
  const resumeText =
    typeof payload.resumeContent === 'string'
      ? payload.resumeContent
      : JSON.stringify(payload.resumeContent, null, 2)

  const skillsSection = payload.skills?.length
    ? `\n\nUser-specified skills to emphasize:\n${payload.skills.join(', ')}`
    : ''

  return `You are an expert resume writer specializing in STAR-format bullet points and ATS optimization.

CRITICAL INSTRUCTIONS:
- Do NOT invent companies, dates, metrics, degrees, or any factual information
- ONLY rewrite and reframe existing content
- Use STAR format (Situation/Task, Action, Result) for experience bullets
- If metrics are missing, use qualitative results without fabricating numbers
- Emphasize skills and keywords from the job description
- Keep section structure intact
- Be concise and professional

JOB DESCRIPTION:
${payload.jobDescription}
${skillsSection}

CURRENT RESUME:
${resumeText}

OUTPUT FORMAT (strict JSON):
{
  "tailoredResume": "full rewritten resume text with STAR bullets and job-relevant keywords",
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]
}

Return ONLY valid JSON. No markdown, no code blocks, no explanations.`
}

const parseGeminiResponse = (response: unknown): ResumeTailorResult | null => {
  if (!response || typeof response !== 'object') return null

  const candidates = (response as { candidates?: unknown[] }).candidates
  if (!Array.isArray(candidates) || candidates.length === 0) return null

  const firstCandidate = candidates[0]
  if (!firstCandidate || typeof firstCandidate !== 'object') return null

  const content = (firstCandidate as { content?: unknown }).content
  if (!content || typeof content !== 'object') return null

  const parts = (content as { parts?: unknown[] }).parts
  if (!Array.isArray(parts) || parts.length === 0) return null

  const text = (parts[0] as { text?: unknown }).text
  if (typeof text !== 'string') return null

  // Strip markdown code blocks if present
  const cleanedText = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleanedText)
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== 'object') return null

  const result = parsed as { tailoredResume?: unknown; suggestions?: unknown }

  if (typeof result.tailoredResume !== 'string') return null
  if (!Array.isArray(result.suggestions)) return null
  if (!result.suggestions.every((s) => typeof s === 'string')) return null

  return {
    tailoredResume: result.tailoredResume,
    suggestions: result.suggestions,
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
      temperature: 0.7,
      maxOutputTokens: 4096,
    },
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
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

      if (!parsed) {
        throw new Error('Failed to parse Gemini response into expected JSON format')
      }

      return parsed
    } catch (error) {
      clearTimeout(timeoutId)
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
        continue
      }
    }
  }

  throw lastError || new Error('AI request failed after retries')
}
