import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { handleActivityEvents, type HandlerDeps } from './handler.ts'

const makeDeps = (overrides?: Partial<HandlerDeps>): HandlerDeps => ({
  getUserFromAuth: async () => ({ id: 'user-1' }),
  insertEvent: async () => ({ id: 'evt-1', created_at: new Date().toISOString() }),
  refreshSessions: async () => {},
  ...overrides,
})

Deno.test('valid event returns 201 with success payload', async () => {
  const request = new Request('http://localhost', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      activity_type: 'resume',
      event_type: 'resume_saved',
      metadata: { source: 'manual' },
    }),
  })

  const response = await handleActivityEvents(request, makeDeps())
  const body = await response.json()

  assertEquals(response.status, 201)
  assertEquals(body.status, 'success')
  assertEquals(typeof body.data.id, 'string')
})

Deno.test('unknown activity_type returns 400 invalid_activity', async () => {
  const request = new Request('http://localhost', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      activity_type: 'unknown',
      event_type: 'resume_saved',
    }),
  })

  const response = await handleActivityEvents(request, makeDeps())
  const body = await response.json()

  assertEquals(response.status, 400)
  assertEquals(body.code, 'invalid_activity')
})

Deno.test('unknown event_type for valid activity returns 400', async () => {
  const request = new Request('http://localhost', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      activity_type: 'interview',
      event_type: 'not_allowed',
    }),
  })

  const response = await handleActivityEvents(request, makeDeps())

  assertEquals(response.status, 400)
})

Deno.test('forbidden metadata key is stripped before insert', async () => {
  let capturedMetadata: Record<string, unknown> | null = null

  const request = new Request('http://localhost', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      activity_type: 'interview',
      event_type: 'question_answered',
      metadata: {
        answerText: 'secret',
        lengthBucket: 'short',
      },
    }),
  })

  const response = await handleActivityEvents(
    request,
    makeDeps({
      insertEvent: async (payload) => {
        capturedMetadata = payload.metadata
        return { id: 'evt-2', created_at: new Date().toISOString() }
      },
    })
  )

  assertEquals(response.status, 201)
  assertEquals(capturedMetadata?.answerText, undefined)
  assertEquals(capturedMetadata?.lengthBucket, 'short')
})

Deno.test('missing or invalid JWT returns 401', async () => {
  const request = new Request('http://localhost', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      activity_type: 'resume',
      event_type: 'resume_saved',
    }),
  })

  const response = await handleActivityEvents(
    request,
    makeDeps({
      getUserFromAuth: async () => null,
    })
  )

  assertEquals(response.status, 401)
})
