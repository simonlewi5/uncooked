import { corsHeaders } from '../_shared/cors.ts'

interface ResearchChatRequest {
  companies: string[]
  message: string
  jobDescription?: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  attachment?: { fileName: string; text: string }
}

function buildUserTurnText(message: string, attachment?: { fileName: string; text: string }): string {
  const m = message.trim()
  const doc = attachment?.text?.trim()
  if (!doc || !attachment) return m

  return `${m}

USER_UPLOADED_DOCUMENT (${attachment.fileName})
Use chat history above plus this excerpt and the selected companies. Ground file-specific answers in the text below; use prior turns for follow-ups. Quote or paraphrase; do not contradict the document. Say briefly if it does not apply.

--- document start ---
${doc}
--- document end ---`
}

function requireAuth(req: Request): Response | null {
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: missing or invalid Authorization header' }),
      {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders,
    })
  }

  const authError = requireAuth(req)
  if (authError) return authError

  try {
    const body = (await req.json()) as ResearchChatRequest
    const {
      companies,
      message,
      jobDescription,
      history = [],
      attachment,
    } = body

    const hasAttachment = Boolean(attachment?.text?.trim())
    if (!companies?.length || (!message?.trim() && !hasAttachment)) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: companies (non-empty array) and message',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const companyList = companies.join(', ')
    const systemPrompt = `You are a research assistant helping the user analyze companies and roles. Focus only on the company/companies they have selected.

## Selected companies
${companyList}

${jobDescription?.trim() ? `## Job description context (use to tailor answers about fit, skills, or role)\n${jobDescription.trim()}` : ''}

## Guidelines
- Answer based on the specified company/companies only; be concise and factual.
- Use chat history on every turn; do not ignore prior user or assistant messages.
- If a USER_UPLOADED_DOCUMENT block appears in this turn, treat it as the source for file-specific claims and combine it with history and companies.
- Plain text only (no markdown: no asterisks, # headings, or line-leading list markers). Short paragraphs; blank lines between ideas.`

    const userTurnText = buildUserTurnText(message, attachment)

    const contents = [
      ...history.map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      })),
      {
        role: 'user',
        parts: [{ text: userTurnText }],
      },
    ]

    const geminiRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
        }),
      }
    )

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text()
      let errMessage = 'Failed to generate response'
      try {
        const errJson = JSON.parse(errBody)
        errMessage = errJson.error?.message ?? errMessage
      } catch {
        errMessage = errBody || errMessage
      }
      return new Response(
        JSON.stringify({ error: errMessage }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const stream = geminiRes.body
    if (!stream) {
      return new Response(
        JSON.stringify({ error: 'No response body from AI' }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const encoder = new TextEncoder()
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    const sseStream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split(/\r?\n/)
            buffer = lines.pop() ?? ''
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                if (data === '[DONE]') continue
                try {
                  const obj = JSON.parse(data)
                  const text = obj.candidates?.[0]?.content?.parts?.[0]?.text
                  if (text) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
                  }
                } catch {
                  // skip malformed chunk
                }
              }
            }
          }
          if (buffer.trim()) {
            try {
              if (buffer.startsWith('data: ')) {
                const data = buffer.slice(6)
                const obj = JSON.parse(data)
                const text = obj.candidates?.[0]?.content?.parts?.[0]?.text
                if (text) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
                }
              }
            } catch {
              // ignore
            }
          }
        } finally {
          controller.close()
        }
      },
    })

    return new Response(sseStream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Error in research-chat:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
