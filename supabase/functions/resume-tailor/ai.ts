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
  structuredResume: {
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
    extraSections: Array<{ title: string; content: string }>
  }
  parseConfidence: number
  warnings: string[]
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
const MAX_TARGET_KEYWORDS = 20

const STOP_WORDS = new Set([
  'a',
  'about',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'have',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'our',
  'that',
  'the',
  'their',
  'this',
  'to',
  'we',
  'will',
  'with',
  'you',
  'your',
])

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

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

const toStructuredResume = (normalized: NormalizedResume): ResumeTailorResult['structuredResume'] => ({
  name: normalized.known.name,
  contact: normalized.known.contact,
  summary: normalized.known.summary,
  experience: normalized.known.experience,
  education: normalized.known.education,
  skills: normalized.known.skills,
  extraSections: normalized.extraSections,
})

const normalizeStructuredResume = (
  value: unknown,
  fallback: ResumeTailorResult['structuredResume'],
): ResumeTailorResult['structuredResume'] => {
  if (!isRecord(value)) return fallback

  const STAR_PART_REGEX = /^\**\s*(situation\/?task|situation|task|action|result)\s*:\s*/i

  const mergeStarBullets = (bullets: string[]): string[] => {
    if (bullets.length === 0) return bullets

    const merged: string[] = []
    let starParts: string[] = []

    const flushStarParts = () => {
      if (starParts.length === 0) return
      merged.push(starParts.join(' ').trim())
      starParts = []
    }

    for (const bullet of bullets) {
      const trimmed = bullet.trim()
      if (!trimmed) continue

      if (STAR_PART_REGEX.test(trimmed)) {
        starParts.push(trimmed.replace(STAR_PART_REGEX, '').trim())
        continue
      }

      flushStarParts()
      merged.push(trimmed)
    }

    flushStarParts()
    return merged
  }

  const normalizedExperience = Array.isArray(value.experience)
    ? value.experience
        .map((entry) => {
          if (!isRecord(entry)) return null
          return {
            title: typeof entry.title === 'string' ? entry.title : '',
            company: typeof entry.company === 'string' ? entry.company : '',
            period: typeof entry.period === 'string' ? entry.period : '',
            bullets: Array.isArray(entry.bullets)
              ? mergeStarBullets(
                  entry.bullets.filter((item): item is string => typeof item === 'string'),
                )
              : [],
          }
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    : fallback.experience

  const normalizedEducation = Array.isArray(value.education)
    ? value.education
        .map((entry) => {
          if (!isRecord(entry)) return null
          return {
            degree: typeof entry.degree === 'string' ? entry.degree : '',
            school: typeof entry.school === 'string' ? entry.school : '',
            period: typeof entry.period === 'string' ? entry.period : '',
          }
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    : fallback.education

  const normalizedSkills = Array.isArray(value.skills)
    ? value.skills.filter((item): item is string => typeof item === 'string')
    : fallback.skills

  const normalizedExtraSections = Array.isArray(value.extraSections)
    ? value.extraSections
        .map((entry) => {
          if (!isRecord(entry)) return null
          if (typeof entry.title !== 'string' || typeof entry.content !== 'string') return null
          return { title: entry.title, content: entry.content }
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    : fallback.extraSections

  return {
    name: typeof value.name === 'string' ? value.name : fallback.name,
    contact: typeof value.contact === 'string' ? value.contact : fallback.contact,
    summary: typeof value.summary === 'string' ? value.summary : fallback.summary,
    experience: normalizedExperience,
    education: normalizedEducation,
    skills: normalizedSkills,
    extraSections: normalizedExtraSections,
  }
}

const extractTargetKeywords = (
  jobDescription: string,
  userSkills: string[] | undefined,
): string[] => {
  const wordMatches = jobDescription.toLowerCase().match(/[a-z][a-z0-9+#.\-/]{2,}/g) ?? []
  const frequencies = new Map<string, number>()

  for (const rawWord of wordMatches) {
    const word = rawWord.trim()
    if (!word || STOP_WORDS.has(word)) continue
    frequencies.set(word, (frequencies.get(word) ?? 0) + 1)
  }

  const sorted = [...frequencies.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)

  const prioritizedSkillTokens = (userSkills ?? [])
    .flatMap((skill) => skill.toLowerCase().split(/\s+/))
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))

  const merged = [...new Set([...prioritizedSkillTokens, ...sorted])]
  return merged.slice(0, MAX_TARGET_KEYWORDS)
}

const buildTailoringPlan = (normalizedResume: NormalizedResume): string => {
  const experienceCount = normalizedResume.known.experience.length
  const educationCount = normalizedResume.known.education.length
  const skillsCount = normalizedResume.known.skills.length
  const extraSectionsCount = normalizedResume.extraSections.length

  return [
    `- Parse confidence: ${normalizedResume.parseConfidence.toFixed(2)}`,
    `- Experience entries detected: ${experienceCount}`,
    `- Education entries detected: ${educationCount}`,
    `- Skills detected: ${skillsCount}`,
    `- Extra sections detected: ${extraSectionsCount}`,
    '- Keep every known section present in the source resume.',
    '- If confidence is low (< 0.60), prioritize conservative edits and preserve original wording where uncertain.',
    '- Rewrite experience bullets in STAR style while preserving facts and chronology.',
    '- Integrate target keywords naturally; do not keyword-stuff.',
    '- Keep unknown/extra sections in the final output unless clearly empty.',
  ].join('\n')
}

const buildPrompt = (payload: ResumeTailorPayload, normalizedResume: NormalizedResume): string => {
  const targetKeywords = extractTargetKeywords(payload.jobDescription, payload.skills)
  const tailoringPlan = buildTailoringPlan(normalizedResume)

  const skillsSection = payload.skills?.length
    ? `\n\nUser-specified skills to emphasize:\n${payload.skills.join(', ')}`
    : ''

  return `You are an expert resume writer specializing in STAR-format bullet points and ATS optimization.

CRITICAL INSTRUCTIONS:
- Do NOT invent companies, dates, metrics, degrees, or any factual information
- ONLY rewrite and reframe existing content
- Use STAR format (Situation/Task, Action, Result) inside each bullet
- Output ONE bullet per accomplishment, not separate bullets for Situation/Task, Action, and Result
- Do not prefix bullets with "Situation/Task:", "Action:", or "Result:"
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

TARGET KEYWORDS (highest priority first):
${targetKeywords.join(', ')}

TAILORING PLAN:
${tailoringPlan}

OUTPUT FORMAT (strict JSON):
{
  "tailoredResume": "full rewritten resume text with STAR bullets and job-relevant keywords",
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"],
  "structuredResume": {
    "name": "candidate name",
    "contact": "contact line",
    "summary": "professional summary",
    "experience": [
      {
        "title": "role title",
        "company": "company",
        "period": "date range",
        "bullets": ["STAR bullet 1", "STAR bullet 2"]
      }
    ],
    "education": [
      {
        "degree": "degree",
        "school": "school",
        "period": "date range"
      }
    ],
    "skills": ["skill 1", "skill 2"],
    "extraSections": [
      {
        "title": "Projects",
        "content": "preserved section content"
      }
    ]
  },
  "parseConfidence": 0.0,
  "warnings": ["warning message if any"]
}

Return ONLY valid JSON. No markdown, no code blocks, no explanations.`
}

const getCandidateTextPreview = (response: unknown): string | null => {
  if (!response || typeof response !== 'object') return null
  const candidates = (response as { candidates?: unknown[] }).candidates
  if (!Array.isArray(candidates) || candidates.length === 0) return null
  const content = (candidates[0] as { content?: unknown }).content
  if (!content || typeof content !== 'object') return null
  const parts = (content as { parts?: unknown[] }).parts
  if (!Array.isArray(parts) || parts.length === 0) return null
  const text = (parts[0] as { text?: unknown }).text
  return typeof text === 'string' ? text.slice(0, 500) : null
}

const parseGeminiResponse = (
  response: unknown,
  fallbackNormalized: NormalizedResume,
): ResumeTailorResult | null => {
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

  // Gemini may wrap JSON in fences or append trailing commentary; recover the JSON object robustly.
  const cleanedText = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  const parseJsonCandidate = (candidate: string): unknown | null => {
    try {
      return JSON.parse(candidate)
    } catch {
      return null
    }
  }

  let parsed: unknown | null = parseJsonCandidate(cleanedText)

  if (!parsed) {
    const firstBrace = cleanedText.indexOf('{')
    const lastBrace = cleanedText.lastIndexOf('}')
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const extracted = cleanedText.slice(firstBrace, lastBrace + 1)
      parsed = parseJsonCandidate(extracted)
    }
  }

  if (!parsed) {
    return null
  }

  if (!parsed || typeof parsed !== 'object') return null

  const result = parsed as {
    tailoredResume?: unknown
    suggestions?: unknown
    structuredResume?: unknown
    parseConfidence?: unknown
    warnings?: unknown
  }

  if (typeof result.tailoredResume !== 'string') return null
  const suggestions = Array.isArray(result.suggestions)
    ? result.suggestions.filter((s): s is string => typeof s === 'string')
    : []

  const fallbackStructured = toStructuredResume(fallbackNormalized)
  const structuredResume = normalizeStructuredResume(result.structuredResume, fallbackStructured)
  const parseConfidence =
    typeof result.parseConfidence === 'number'
      ? clamp01(result.parseConfidence)
      : fallbackNormalized.parseConfidence
  const warnings = Array.isArray(result.warnings)
    ? result.warnings.filter((warning): warning is string => typeof warning === 'string')
    : fallbackNormalized.warnings

  return {
    tailoredResume: result.tailoredResume,
    suggestions,
    structuredResume,
    parseConfidence,
    warnings,
  }
}

export const tailorResumeWithAI = async (
  payload: ResumeTailorPayload
): Promise<ResumeTailorResult> => {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY environment variable')
  }

  const normalizedResume = normalizeResumeContent(payload.resumeContent)
  const prompt = buildPrompt(payload, normalizedResume)

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
      const parsed = parseGeminiResponse(data, normalizedResume)

      if (!parsed) {
        console.error('[resume-tailor] Failed to parse Gemini response', {
          preview: getCandidateTextPreview(data),
        })
        throw new Error('Failed to parse Gemini response into expected JSON format')
      }

      return parsed
    } catch (error) {
      clearTimeout(timeoutId)
      lastError = error instanceof Error ? error : new Error(String(error))
      console.error('[resume-tailor] Gemini attempt failed', {
        attempt,
        message: lastError.message,
      })

      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
        continue
      }
    }
  }

  throw lastError || new Error('AI request failed after retries')
}
