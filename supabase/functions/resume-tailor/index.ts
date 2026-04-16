import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders } from '../_shared/cors.ts'
import {
  MAX_BODY_BYTES,
  MAX_JOB_DESCRIPTION_CHARS,
  MAX_RESUME_OBJECT_CHARS,
  MIN_JOB_DESCRIPTION_CHARS,
} from './constants.ts'
import { tailorResumeWithAI, type ResumeTailorEdit, type ResumeTailorPayload } from './ai.ts'
import { DEBUG_ENABLED, DEBUG_VERBOSE, isRecord, toDebugPreview } from './utils.ts'

declare const Deno: {
  env: {
    get: (key: string) => string | undefined
  }
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
}

const debugLog = (requestId: string, event: string, data?: Record<string, unknown>) => {
  if (!DEBUG_ENABLED) return

  console.log('resume-tailor.http', {
    requestId,
    event,
    ...data,
  })
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const isTextNode = (value: unknown): value is { id: string; text: string } =>
  isRecord(value) && typeof value.id === 'string' && typeof value.text === 'string'

const isExperienceEntry = (
  value: unknown
): value is {
  id: string
  title: { id: string; text: string }
  company: { id: string; text: string }
  period: { id: string; text: string }
  bullets: Array<{ id: string; text: string }>
} => {
  if (!isRecord(value)) return false

  return (
    typeof value.id === 'string' &&
    isTextNode(value.title) &&
    isTextNode(value.company) &&
    isTextNode(value.period) &&
    Array.isArray(value.bullets) &&
    value.bullets.every((bullet) => isTextNode(bullet))
  )
}

const isEducationEntry = (
  value: unknown
): value is {
  id: string
  degree: { id: string; text: string }
  school: { id: string; text: string }
  period: { id: string; text: string }
} => {
  if (!isRecord(value)) return false

  return (
    typeof value.id === 'string' &&
    isTextNode(value.degree) &&
    isTextNode(value.school) &&
    isTextNode(value.period)
  )
}

const isValidResumeContent = (value: unknown): value is Record<string, unknown> => {
  if (!isRecord(value)) return false

  if (!isTextNode(value.name) || !isTextNode(value.contact) || !isTextNode(value.summary)) {
    return false
  }

  if (!Array.isArray(value.experience) || !value.experience.every((entry) => isExperienceEntry(entry))) {
    return false
  }

  if (!Array.isArray(value.education) || !value.education.every((entry) => isEducationEntry(entry))) {
    return false
  }

  if (!Array.isArray(value.skills) || !value.skills.every((skill) => isTextNode(skill))) {
    return false
  }

  return true
}

const collectKnownTargetIds = (value: unknown, targetIds: Set<string> = new Set()): Set<string> => {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectKnownTargetIds(item, targetIds)
    }
    return targetIds
  }

  if (!isRecord(value)) return targetIds

  const maybeId = value.id
  if (typeof maybeId === 'string' && maybeId.trim()) {
    targetIds.add(maybeId.trim())
  }

  for (const nested of Object.values(value)) {
    collectKnownTargetIds(nested, targetIds)
  }

  return targetIds
}

const filterResolvableEdits = (edits: ResumeTailorEdit[] | undefined, targetIds: Set<string>) => {
  if (!edits?.length) return []

  const filtered = edits.filter((edit) => targetIds.has(edit.targetId))

  if (filtered.length !== edits.length) {
    console.warn('resume-tailor dropped unresolved edits', {
      before: edits.length,
      after: filtered.length,
    })
  }

  return filtered
}

const normalizeBody = (payload: unknown): ResumeTailorPayload | null => {
  if (!isRecord(payload)) return null

  const { jobDescription, resumeContent } = payload
  const mode = payload.mode
  if (typeof jobDescription !== 'string') return null

  if (!isValidResumeContent(resumeContent)) return null

  if (mode !== undefined && mode !== 'delta_only') {
    return null
  }

  return {
    jobDescription,
    resumeContent,
    mode,
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

  const resumeObjectLength = JSON.stringify(payload.resumeContent).length
  if (resumeObjectLength > MAX_RESUME_OBJECT_CHARS) {
    return `resumeContent object is too large (max ${MAX_RESUME_OBJECT_CHARS} characters when stringified)`
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
  const requestId = crypto.randomUUID().slice(0, 8)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  debugLog(requestId, 'request_received', {
    method: req.method,
    hasAuthorization: Boolean(req.headers.get('authorization')),
    contentLength: req.headers.get('content-length') ?? null,
  })

  if (req.method !== 'POST') {
    return json(405, { error: 'Method Not Allowed', code: 'method_not_allowed' })
  }

  // Fast-path: Check Content-Length header for well-behaved clients.
  const contentLength = req.headers.get('content-length')
  if (contentLength) {
    const size = parseInt(contentLength, 10)
    if (isNaN(size) || size > MAX_BODY_BYTES) {
      return json(413, {
        error: 'Payload Too Large',
        code: 'payload_too_large',
        details: `request body exceeds ${MAX_BODY_BYTES} bytes`,
      })
    }
  }

  // Read body with size enforcement to prevent memory exhaustion from malicious clients.
  let bodyBuffer: ArrayBuffer
  try {
    const reader = req.body?.getReader()
    if (!reader) {
      return json(400, { error: 'Failed to read request body', code: 'invalid_body' })
    }

    const chunks: Uint8Array[] = []
    let totalBytes = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      totalBytes += value.length
      if (totalBytes > MAX_BODY_BYTES) {
        reader.cancel()
        return json(413, {
          error: 'Payload Too Large',
          code: 'payload_too_large',
          details: `request body exceeds ${MAX_BODY_BYTES} bytes`,
        })
      }

      chunks.push(value)
    }

    // Concatenate chunks into single buffer
    const combined = new Uint8Array(totalBytes)
    let offset = 0
    for (const chunk of chunks) {
      combined.set(chunk, offset)
      offset += chunk.length
    }
    bodyBuffer = combined.buffer
  } catch {
    return json(400, { error: 'Failed to read request body', code: 'invalid_body' })
  }

  let userId: string | null = null
  try {
    userId = await getAuthenticatedUserId(req)
  } catch (_error) {
    debugLog(requestId, 'auth_misconfigured')
    return json(500, {
      error: 'Server Misconfiguration',
      details: 'Missing required Supabase environment variables',
    })
  }

  if (!userId) {
    debugLog(requestId, 'auth_failed')
    return json(401, { error: 'Unauthorized' })
  }

  let parsedBody: unknown
  try {
    const bodyText = new TextDecoder().decode(bodyBuffer)
    parsedBody = JSON.parse(bodyText)
  } catch {
    debugLog(requestId, 'invalid_json_body')
    return json(400, { error: 'Invalid JSON body' })
  }

  const payload = normalizeBody(parsedBody)
  if (!payload) {
    debugLog(requestId, 'invalid_payload_shape', {
      payloadPreview: DEBUG_VERBOSE ? toDebugPreview(parsedBody) : undefined,
    })
    return json(400, {
      error: 'Invalid payload shape',
      details:
        'Expected { jobDescription: string, resumeContent: ResumeDocument, mode?: delta_only }',
    })
  }

  debugLog(requestId, 'payload_normalized', {
    userId,
    mode: payload.mode ?? 'delta_only',
    jobDescriptionChars: payload.jobDescription.length,
    resumeObjectChars: JSON.stringify(payload.resumeContent).length,
    payloadPreview: DEBUG_VERBOSE ? toDebugPreview(payload) : undefined,
  })

  const validationError = validatePayload(payload)
  if (validationError) {
    debugLog(requestId, 'payload_validation_failed', { validationError })
    return json(400, {
      error: 'Validation failed',
      details: validationError,
    })
  }

  // Phase 4: AI tailoring
  let tailorResult
  try {
    tailorResult = await tailorResumeWithAI(payload, { requestId })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    debugLog(requestId, 'tailor_failed', { errorMessage })

    // Distinguish between client errors and server errors
    if (errorMessage.includes('Missing GEMINI_API_KEY')) {
      return json(500, {
        error: 'Server Misconfiguration',
        details: 'AI service not configured',
      })
    }

    if (errorMessage.includes('Gemini API error')) {
      if (errorMessage.includes('(429)') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
        return json(429, {
          error: 'AI Rate Limited',
          details: 'Gemini quota exceeded. Please wait and retry, or use an API key with higher quota.',
        })
      }

      return json(502, {
        error: 'AI Service Error',
        details: 'Failed to process resume with AI service',
      })
    }

    if (errorMessage.includes('Failed to parse')) {
      const parseReason = errorMessage.includes('[truncated]')
        ? 'truncated'
        : errorMessage.includes('[safety_filtered]')
          ? 'safety_filtered'
          : errorMessage.includes('[missing_text]') || errorMessage.includes('[missing_content]')
            ? 'empty_response'
            : 'invalid_format'

      debugLog(requestId, 'tailor_parse_failed', {
        parseReason,
      })

      return json(502, {
        error: 'AI Parse Error',
        details: `AI response was ${parseReason}. Please try again.`,
      })
    }

    // Generic AI failure
    return json(502, {
      error: 'AI Processing Failed',
      details: 'Unable to tailor resume at this time',
    })
  }

  const knownTargetIds = collectKnownTargetIds(payload.resumeContent)
  const resolvedEdits = filterResolvableEdits(tailorResult.edits, knownTargetIds)

  debugLog(requestId, 'tailor_success', {
    returnedEdits: tailorResult.edits?.length ?? 0,
    resolvedEdits: resolvedEdits.length,
    resultPreview: DEBUG_VERBOSE
      ? toDebugPreview({
          edits: resolvedEdits,
          appliedMode: tailorResult.appliedMode,
        })
      : undefined,
  })

  return json(200, {
    edits: resolvedEdits,
    appliedMode: tailorResult.appliedMode,
  })
})
