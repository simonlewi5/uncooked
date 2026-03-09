import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { tailorResumeWithAI, type ResumeTailorPayload } from './ai.ts'

declare const Deno: {
  env: {
    get: (key: string) => string | undefined
  }
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
}

const MAX_BODY_BYTES = 80_000
const MIN_JOB_DESCRIPTION_CHARS = 200
const MAX_JOB_DESCRIPTION_CHARS = 12_000
const MIN_RESUME_TEXT_CHARS = 200
const MAX_RESUME_TEXT_CHARS = 20_000
const MAX_RESUME_OBJECT_CHARS = 30_000
const MAX_SKILLS = 30
const MAX_SKILL_CHARS = 40

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const normalizeBody = (payload: unknown): ResumeTailorPayload | null => {
  if (!isRecord(payload)) return null

  const { jobDescription, resumeContent, skills } = payload
  if (typeof jobDescription !== 'string') return null

  const isResumeString = typeof resumeContent === 'string'
  const isResumeObject = isRecord(resumeContent)
  if (!isResumeString && !isResumeObject) return null

  if (skills !== undefined) {
    if (!Array.isArray(skills)) return null
    if (!skills.every((skill) => typeof skill === 'string')) return null
  }

  return {
    jobDescription,
    resumeContent,
    skills,
  }
}

const validatePayload = (payload: ResumeTailorPayload): string | null => {
  const jobDescription = payload.jobDescription.trim()
  if (jobDescription.length < MIN_JOB_DESCRIPTION_CHARS) {
    return `jobDescription must be at least ${MIN_JOB_DESCRIPTION_CHARS} characters`
  }
  if (jobDescription.length > MAX_JOB_DESCRIPTION_CHARS) {
    return `jobDescription must be at most ${MAX_JOB_DESCRIPTION_CHARS} characters`
  }

  if (typeof payload.resumeContent === 'string') {
    const resumeText = payload.resumeContent.trim()
    if (resumeText.length < MIN_RESUME_TEXT_CHARS) {
      return `resumeContent must be at least ${MIN_RESUME_TEXT_CHARS} characters when provided as text`
    }
    if (resumeText.length > MAX_RESUME_TEXT_CHARS) {
      return `resumeContent must be at most ${MAX_RESUME_TEXT_CHARS} characters when provided as text`
    }
  } else {
    const resumeObjectLength = JSON.stringify(payload.resumeContent).length
    if (resumeObjectLength > MAX_RESUME_OBJECT_CHARS) {
      return `resumeContent object is too large (max ${MAX_RESUME_OBJECT_CHARS} characters when stringified)`
    }
  }

  if (payload.skills) {
    if (payload.skills.length > MAX_SKILLS) {
      return `skills cannot contain more than ${MAX_SKILLS} items`
    }

    for (const skill of payload.skills) {
      const normalized = skill.trim()
      if (!normalized) {
        return 'skills cannot contain empty values'
      }
      if (normalized.length > MAX_SKILL_CHARS) {
        return `each skill must be at most ${MAX_SKILL_CHARS} characters`
      }
    }
  }

  return null
}

const getAuthenticatedUserId = async (req: Request): Promise<string | null> => {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return null

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY')
  }

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: 'GET',
    headers: {
      Authorization: authHeader,
      apikey: supabaseAnonKey,
    },
  })

  if (!authResponse.ok) return null

  const user = (await authResponse.json()) as { id?: unknown }
  if (typeof user.id !== 'string' || !user.id) return null

  return user.id
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method Not Allowed' })
  }

  const contentLengthHeader = req.headers.get('content-length')
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader)
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return json(413, {
        error: 'Payload Too Large',
        details: `request body exceeds ${MAX_BODY_BYTES} bytes`,
      })
    }
  }

  let userId: string | null = null
  try {
    userId = await getAuthenticatedUserId(req)
  } catch (_error) {
    return json(500, {
      error: 'Server Misconfiguration',
      details: 'Missing required Supabase environment variables',
    })
  }

  if (!userId) {
    return json(401, { error: 'Unauthorized' })
  }

  let parsedBody: unknown
  try {
    parsedBody = await req.json()
  } catch {
    return json(400, { error: 'Invalid JSON body' })
  }

  const payload = normalizeBody(parsedBody)
  if (!payload) {
    return json(400, {
      error: 'Invalid payload shape',
      details:
        'Expected { jobDescription: string, resumeContent: string|object, skills?: string[] }',
    })
  }

  const validationError = validatePayload(payload)
  if (validationError) {
    return json(400, {
      error: 'Validation failed',
      details: validationError,
    })
  }

  // Phase 4: AI tailoring
  let tailorResult
  try {
    tailorResult = await tailorResumeWithAI(payload)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[resume-tailor] AI tailoring failed', {
      errorMessage,
      userId,
    })

    // Distinguish between client errors and server errors
    if (errorMessage.includes('Missing GEMINI_API_KEY')) {
      return json(500, {
        error: 'Server Misconfiguration',
        details: 'AI service not configured',
      })
    }

    if (errorMessage.includes('Gemini API error')) {
      return json(502, {
        error: 'AI Service Error',
        details: 'Failed to process resume with AI service',
      })
    }

    if (errorMessage.includes('Failed to parse')) {
      return json(502, {
        error: 'AI Response Error',
        details: 'AI service returned invalid response format',
      })
    }

    // Generic AI failure
    return json(502, {
      error: 'AI Processing Failed',
      details: 'Unable to tailor resume at this time',
    })
  }

  return json(200, {
    tailoredResume: tailorResult.tailoredResume,
    suggestions: tailorResult.suggestions,
    structuredResume: tailorResult.structuredResume,
    parseConfidence: tailorResult.parseConfidence,
    warnings: tailorResult.warnings,
  })
})
