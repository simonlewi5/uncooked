import { corsHeaders } from '../_shared/cors.ts'

export type ActivityType = 'resume' | 'interview' | 'research'

export type StructuredError = {
  error: string
  code?: string
  details?: string
}

type RequestBody = {
  activity_type?: string
  event_type?: string
  metadata?: Record<string, unknown>
  session_id?: string
  duration_seconds?: number
}

type EventInsertPayload = {
  user_id: string
  activity_type: ActivityType
  event_type: string
  metadata: Record<string, unknown>
  session_id?: string
  duration_seconds: number
}

type EventInsertResult = {
  id: string
  created_at: string
}

type EventInsertPayloadWithoutSession = Omit<EventInsertPayload, 'session_id'>

export type HandlerDeps = {
  getUserFromAuth: (authHeader: string) => Promise<{ id: string } | null>
  insertEvent: (payload: EventInsertPayload) => Promise<EventInsertResult>
  refreshSessions: () => Promise<void>
}

const ALLOWED_EVENTS: Record<ActivityType, readonly string[]> = {
  resume: ['edit_committed', 'resume_saved', 'ai_tailor_triggered', 'version_created'],
  interview: ['session_started', 'question_answered', 'session_completed', 'feedback_received', 'session_partial'],
  research: ['company_added', 'note_saved', 'link_bookmarked', 'board_write'],
}

const FORBIDDEN_METADATA_KEYS = new Set([
  'resumeContent',
  'resumeText',
  'interviewAnswer',
  'answerText',
  'companyName',
  'jobDescription',
  'rawContent',
])

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const isActivityType = (value: string): value is ActivityType =>
  value === 'resume' || value === 'interview' || value === 'research'

const sanitizeMetadata = (input: unknown): Record<string, unknown> => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}

  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (FORBIDDEN_METADATA_KEYS.has(key)) continue
    if (
      value === null ||
      typeof value === 'boolean' ||
      typeof value === 'number' ||
      typeof value === 'string'
    ) {
      if (typeof value === 'string' && value.length > 120) continue
      out[key] = value
    }
  }

  return out
}

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

export async function handleActivityEvents(req: Request, deps: HandlerDeps): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed', code: 'method_not_allowed' })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json(401, { error: 'Missing Authorization header.', code: 'unauthorized' })
  }

  const user = await deps.getUserFromAuth(authHeader)
  if (!user) {
    return json(401, { error: 'Invalid or expired session.', code: 'unauthorized' })
  }

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return json(400, { error: 'Invalid JSON body', code: 'invalid_body' })
  }

  const activityType = body.activity_type
  if (!activityType || !isActivityType(activityType)) {
    return json(400, {
      error: 'Validation failed',
      code: 'invalid_activity',
      details: 'activity_type must be one of: resume, interview, research',
    })
  }

  const eventType = body.event_type
  if (!eventType || !ALLOWED_EVENTS[activityType].includes(eventType)) {
    return json(400, {
      error: 'Validation failed',
      code: 'invalid_event',
      details: `event_type ${eventType ?? 'undefined'} is not allowed for ${activityType}`,
    })
  }

  const metadata = sanitizeMetadata(body.metadata)
  const sessionId = body.session_id && isUuid(body.session_id) ? body.session_id : crypto.randomUUID()
  const durationSeconds = body.duration_seconds ?? 0

  if (!isNonNegativeInteger(durationSeconds)) {
    return json(400, {
      error: 'Validation failed',
      code: 'invalid_duration',
      details: 'duration_seconds must be a non-negative integer',
    })
  }

  try {
    const basePayload: EventInsertPayloadWithoutSession = {
      user_id: user.id,
      activity_type: activityType,
      event_type: eventType,
      metadata,
      duration_seconds: durationSeconds,
    }

    const row = await deps.insertEvent({
      ...basePayload,
      session_id: sessionId,
    })

    // Keep derived daily sessions fresh while avoiding full blocking table locks.
    await deps.refreshSessions()

    return json(201, { status: 'success', data: row })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown insert error'

    if (/session_id/i.test(message) && /column|does not exist/i.test(message)) {
      try {
        const row = await deps.insertEvent({
          user_id: user.id,
          activity_type: activityType,
          event_type: eventType,
          metadata,
          duration_seconds: durationSeconds,
        })

        await deps.refreshSessions()

        return json(201, { status: 'success', data: row })
      } catch (fallbackError) {
        const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : 'Unknown insert error'
        return json(500, {
          error: 'Failed to persist activity event',
          code: 'insert_failed',
          details: fallbackMessage,
        })
      }
    }

    return json(500, {
      error: 'Failed to persist activity event',
      code: 'insert_failed',
      details: message,
    })
  }
}
