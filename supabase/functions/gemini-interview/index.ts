import { corsHeaders } from '../_shared/cors.ts'

interface InterviewRequest {
  jobDescription: string
  companyName: string
  companyContext?: string
  interviewStyle: 'technical' | 'behavioral' | 'mixed'
  userMessage: string
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
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

  try {
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
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
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

    // Build message history for context
    const messages = [
      ...conversationHistory.map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.content }],
      })),
      {
        role: 'user',
        parts: [{ text: userMessage }],
      },
    ]

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0:generateContent',
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
