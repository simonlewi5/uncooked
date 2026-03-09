import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'


interface InterviewRequest {
  jobDescription: string
  companyName: string
  companyContext?: string
  interviewStyle: 'technical' | 'behavioral' | 'mixed'
  userMessage: string
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
}

Deno.serve(async (req) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    // SECURE THE ENDPOINT: Verify the user's Supabase Token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header. Are you logged in?' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session. Please log in again.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const {
      jobDescription,
      companyName,
      companyContext,
      interviewStyle,
      userMessage,
      conversationHistory = [],
    } = (await req.json()) as InterviewRequest

    if (!jobDescription || !companyName || !userMessage || !interviewStyle) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: jobDescription, companyName, userMessage, or interviewStyle',
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
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
    // Fetch message history from KV (not available in local dev runtime — falls back to
    // conversationHistory passed in the request body, which the frontend maintains in state)
    // deno-lint-ignore no-explicit-any
    let kv: any = null
    let storedMessages: string[] = []
    try {
      kv = await Deno.openKv()
      const kvKey = ['interview_messages', user.id]
      const kvEntry = await kv.get(kvKey)
      storedMessages = (kvEntry.value as string[]) || []
    } catch {
      // Deno KV not available (local dev runtime) — use conversationHistory from request body
      storedMessages = conversationHistory.flatMap((m) => [m.content])
      kv = null
    }

    // Extract job level (junior, mid, senior) from job description
    const jobLevelMatch = jobDescription
      .toLowerCase()
      .match(/\b(junior|mid-?level|senior|staff|principal|lead|entry-?level)\b/i)
    const detectedLevel = jobLevelMatch
      ? jobLevelMatch[1].toLowerCase()
      : 'mid-level'

    // Build system prompt with job context
    const systemPrompt = `You are an expert AI interviewer conducting a ${interviewStyle} interview for the role at ${companyName}.

## Job Context
Company: ${companyName}
Job Level: ${detectedLevel}
${companyContext ? `Company Context: ${companyContext}` : ''}

## Job Description
${jobDescription}

## Interview Style: ${interviewStyle}
${
  interviewStyle === 'technical'
    ? 'Ask deeply technical questions related to the technologies and skills mentioned in the job description. Test programming concepts, system design, and problem-solving abilities.'
    : interviewStyle === 'behavioral'
      ? 'Ask behavioral questions about past experiences, teamwork, conflict resolution, and how the candidate handles challenges.'
      : 'Mix both technical and behavioral questions to assess both technical skills and soft skills.'
}

## Guidelines
- Reference specific skills or requirements from the job description in your questions
- Tailor difficulty based on the job level (${detectedLevel})
- Reference the company (${companyName}) and context when relevant
- Keep responses conversational but professional
- Ask follow-up questions when the candidate gives vague answers
- Build on previous answers in the conversation
- For ${detectedLevel} roles, ${
      detectedLevel.includes('junior') || detectedLevel.includes('entry')
        ? 'ask foundational questions and be supportive'
        : detectedLevel.includes('senior') || detectedLevel.includes('staff')
          ? 'expect deep technical knowledge and system thinking'
          : 'ask intermediate to advanced questions'
    }

You are having a conversation with the candidate. Respond naturally and ask your next interview question based on what they just said.`

    // Alternate between user and assistant roles based on position in array
    const messageHistory = storedMessages.map((msg, index) => ({
      role: index % 2 === 0 ? 'user' : 'model',
      parts: [{ text: msg }],
    }))

    const messages = [
      ...messageHistory,
      {
        role: 'user',
        parts: [{ text: userMessage }],
      },
    ]

    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

    const response = await fetch( url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: messages,
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error('Gemini API error:', data)
      return new Response(
        JSON.stringify({
          error: data.error?.message || 'Failed to generate response',
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const generatedText =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      'Sorry, I could not generate a response. Please try again.'
    // Persist updated message history and metadata to KV (skipped in local dev)
    if (kv) {
      const kvKey = ['interview_messages', user.id]
      const updatedMessages = [...storedMessages, userMessage, generatedText]
      await kv.set(kvKey, updatedMessages, { expireIn: 24 * 60 * 60 * 1000 })

      const metadataKey = ['interview_metadata', user.id]
      await kv.set(metadataKey, {
        userId: user.id,
        jobDescription,
        companyName,
        interviewStyle,
        lastUpdated: new Date().toISOString(),
      }, { expireIn: 24 * 60 * 60 * 1000 })

      kv.close()
    }

    return new Response(JSON.stringify({ message: generatedText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in interview function:', error)
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
