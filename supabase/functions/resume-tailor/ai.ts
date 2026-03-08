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

type NormalizedResume = {
  rawText: string
  known: {
    name?: string
    contact?: string
    summary?: string
    experience: Array<{
      title: string
      company: string
      period: string
      bullets: string[]
    }>
    education: Array<{
      degree: string
      school: string
      period: string
    }>
    skills: string[]
  }
  extraSections: Array<{ title: string; content: string }>
  parseConfidence: number
  warnings: string[]
}

const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
const MAX_RETRIES = 2
const TIMEOUT_MS = 60_000
const YEAR_PATTERN = /(19|20)\d{2}/

const KNOWN_SECTION_HEADERS: Record<string, 'summary' | 'experience' | 'education' | 'skills'> = {
  summary: 'summary',
  profile: 'summary',
  'professional summary': 'summary',
  experience: 'experience',
  'work experience': 'experience',
  employment: 'experience',
  education: 'education',
  skills: 'skills',
  'technical skills': 'skills',
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const cleanHeading = (value: string) =>
  value.toLowerCase().replace(/:$/, '').replace(/\s+/g, ' ').trim()

const splitSectionsFromText = (rawText: string) => {
  const lines = rawText.split(/\r?\n/)
  const sections: Array<{ title: string; lines: string[] }> = []
  let currentTitle = 'header'
  let currentLines: string[] = []

  const pushCurrent = () => {
    if (currentLines.length === 0) return
    sections.push({ title: currentTitle, lines: currentLines })
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      currentLines.push('')
      continue
    }

    const normalized = cleanHeading(line)
    const mapped = KNOWN_SECTION_HEADERS[normalized]
    if (mapped) {
      pushCurrent()
      currentTitle = mapped
      currentLines = []
      continue
    }

    currentLines.push(rawLine)
  }

  pushCurrent()
  return sections
}

const parseExperienceLines = (lines: string[]): NormalizedResume['known']['experience'] => {
  const joined = lines.join('\n')
  const blocks = joined
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)

  return blocks
    .map((block) => {
      const blockLines = block.split(/\n/).map((line) => line.trim()).filter(Boolean)
      const bullets = blockLines
        .filter((line) => /^[-*\u2022]\s+/.test(line))
        .map((line) => line.replace(/^[-*\u2022]\s*/, '').trim())
      const nonBulletLines = blockLines.filter((line) => !/^[-*\u2022]\s+/.test(line))

      const header = nonBulletLines[0] ?? ''
      const splitByAt = header.includes(' at ')
      const splitByPipe = header.includes('|')

      let title = header
      let company = ''
      if (splitByAt) {
        const [left, ...rest] = header.split(' at ')
        title = left.trim()
        company = rest.join(' at ').trim()
      } else if (splitByPipe) {
        const [left, ...rest] = header.split('|')
        title = left.trim()
        company = rest.join('|').trim()
      }

      const period = nonBulletLines.find((line) => YEAR_PATTERN.test(line)) ?? ''

      return {
        title,
        company,
        period,
        bullets,
      }
    })
    .filter((entry) => Boolean(entry.title || entry.company || entry.period || entry.bullets.length))
}

const parseEducationLines = (lines: string[]): NormalizedResume['known']['education'] => {
  const joined = lines.join('\n')
  const blocks = joined
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)

  return blocks
    .map((block) => {
      const blockLines = block.split(/\n/).map((line) => line.trim()).filter(Boolean)
      const degree = blockLines[0] ?? ''
      const period = blockLines.find((line) => YEAR_PATTERN.test(line)) ?? ''
      const school = blockLines.find((line, i) => i > 0 && line !== period) ?? ''
      return { degree, school, period }
    })
    .filter((entry) => Boolean(entry.degree || entry.school || entry.period))
}

const parseSkillsLines = (lines: string[]): string[] =>
  lines
    .join(' ')
    .split(/[,;|]/)
    .map((part) => part.trim())
    .filter(Boolean)

const normalizeFromText = (input: string): NormalizedResume => {
  const rawText = input.trim()
  const sections = splitSectionsFromText(rawText)
  const nonEmptyLines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const known: NormalizedResume['known'] = {
    experience: [],
    education: [],
    skills: [],
  }
  const extraSections: NormalizedResume['extraSections'] = []
  const warnings: string[] = []

  const firstLine = nonEmptyLines[0] ?? ''
  const secondLine = nonEmptyLines[1] ?? ''
  if (firstLine && !firstLine.includes('@') && firstLine.length <= 80) {
    known.name = firstLine
  }
  if (secondLine && (secondLine.includes('@') || secondLine.toLowerCase().includes('linkedin'))) {
    known.contact = secondLine
  }

  for (const section of sections) {
    const lines = section.lines.map((line) => line.trim()).filter(Boolean)
    if (lines.length === 0) continue

    if (section.title === 'summary') {
      known.summary = lines.join(' ')
      continue
    }
    if (section.title === 'experience') {
      known.experience = parseExperienceLines(lines)
      continue
    }
    if (section.title === 'education') {
      known.education = parseEducationLines(lines)
      continue
    }
    if (section.title === 'skills') {
      known.skills = parseSkillsLines(lines)
      continue
    }

    if (section.title !== 'header') {
      extraSections.push({
        title: section.title,
        content: lines.join('\n'),
      })
    }
  }

  if (!known.summary) {
    known.summary = nonEmptyLines.slice(0, 3).join(' ')
  }
  if (known.experience.length === 0) {
    warnings.push('Could not confidently extract experience entries from text input')
  }

  let parseConfidence = 0.35
  if (known.name) parseConfidence += 0.15
  if (known.contact) parseConfidence += 0.1
  if (known.summary) parseConfidence += 0.15
  if (known.experience.length > 0) parseConfidence += 0.15
  if (known.education.length > 0) parseConfidence += 0.05
  if (known.skills.length > 0) parseConfidence += 0.05

  return {
    rawText,
    known,
    extraSections,
    parseConfidence: Math.max(0, Math.min(1, parseConfidence)),
    warnings,
  }
}

const normalizeFromObject = (input: Record<string, unknown>): NormalizedResume => {
  const known: NormalizedResume['known'] = {
    experience: [],
    education: [],
    skills: [],
  }
  const extraSections: NormalizedResume['extraSections'] = []

  if (typeof input.name === 'string') known.name = input.name
  if (typeof input.contact === 'string') known.contact = input.contact
  if (typeof input.summary === 'string') known.summary = input.summary

  if (Array.isArray(input.experience)) {
    known.experience = input.experience
      .map((entry) => {
        if (!isRecord(entry)) return null
        return {
          title: typeof entry.title === 'string' ? entry.title : '',
          company: typeof entry.company === 'string' ? entry.company : '',
          period: typeof entry.period === 'string' ? entry.period : '',
          bullets: Array.isArray(entry.bullets)
            ? entry.bullets.filter((item): item is string => typeof item === 'string')
            : [],
        }
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
  }

  if (Array.isArray(input.education)) {
    known.education = input.education
      .map((entry) => {
        if (!isRecord(entry)) return null
        return {
          degree: typeof entry.degree === 'string' ? entry.degree : '',
          school: typeof entry.school === 'string' ? entry.school : '',
          period: typeof entry.period === 'string' ? entry.period : '',
        }
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
  }

  if (Array.isArray(input.skills)) {
    known.skills = input.skills.filter((item): item is string => typeof item === 'string')
  }

  for (const [key, value] of Object.entries(input)) {
    if (['name', 'contact', 'summary', 'experience', 'education', 'skills'].includes(key)) {
      continue
    }
    extraSections.push({
      title: key,
      content: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
    })
  }

  return {
    rawText: JSON.stringify(input, null, 2),
    known,
    extraSections,
    parseConfidence: 0.8,
    warnings: [],
  }
}

const normalizeResumeContent = (
  input: string | Record<string, unknown>,
): NormalizedResume => (typeof input === 'string' ? normalizeFromText(input) : normalizeFromObject(input))

const buildPrompt = (payload: ResumeTailorPayload): string => {
  const normalizedResume = normalizeResumeContent(payload.resumeContent)

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
${normalizedResume.rawText}

NORMALIZED RESUME (best effort extraction):
${JSON.stringify(
    {
      known: normalizedResume.known,
      extraSections: normalizedResume.extraSections,
      parseConfidence: normalizedResume.parseConfidence,
      warnings: normalizedResume.warnings,
    },
    null,
    2,
  )}

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
