import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface GenerateQuestionsRequest {
  jobDescription: string
  companyName: string
  interviewStyle: 'technical' | 'behavioral' | 'mixed' | 'friendly'
  resumeContent?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { jobDescription, companyName, interviewStyle, resumeContent } =
      (await req.json()) as GenerateQuestionsRequest

    if (!jobDescription || !companyName || !interviewStyle) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: jobDescription, companyName, or interviewStyle' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const jobLevelMatch = jobDescription
      .toLowerCase()
      .match(/\b(junior|mid-?level|senior|staff|principal|lead|entry-?level)\b/i)
    const detectedLevel = jobLevelMatch ? jobLevelMatch[1].toLowerCase() : 'mid-level'

    const styleInstruction =
      interviewStyle === 'technical'
        ? 'Focus on technical questions: coding, system design, architecture, debugging, and domain-specific knowledge.'
        : interviewStyle === 'behavioral'
          ? 'Focus on behavioral questions: past experiences, teamwork, conflict resolution, leadership, and situational judgment.'
          : interviewStyle === 'friendly'
            ? 'Focus on conversational questions: motivations, career goals, interests, and culture fit. Keep them warm and open-ended.'
            : 'Mix technical and behavioral questions roughly equally.'

    const systemPrompt = `You are an expert interview coach. Generate 3-5 interview questions for a candidate applying to ${companyName}.

## Job Description
${jobDescription}

## Job Level: ${detectedLevel}

## Interview Style
${styleInstruction}

${resumeContent ? `## Candidate Resume (use to personalize questions)\n${resumeContent}` : ''}

## Instructions
- Tailor questions to the specific role, company, and job level
- Reference specific skills and requirements from the job description
- For ${detectedLevel} roles, ${
      detectedLevel.includes('junior') || detectedLevel.includes('entry')
        ? 'ask foundational questions that assess learning potential'
        : detectedLevel.includes('senior') || detectedLevel.includes('staff')
          ? 'ask questions that probe deep expertise and system thinking'
          : 'ask intermediate to advanced questions'
    }
${resumeContent ? '- Reference the candidate\'s resume experience where relevant to make questions more personalized' : ''}
- Categorize each question as exactly one of: "technical", "behavioral", "situational", or "general"

## Output Format
Return ONLY valid JSON with no extra text:
{"questions": [{"text": "...", "category": "technical|behavioral|situational|general"}, ...]}`

    const url =
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: 'Generate the interview questions now.' }] }],
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Gemini API error:', data)
      return new Response(
        JSON.stringify({ error: data.error?.message || 'Failed to generate questions' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const rawText =
      data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // Strip markdown code fences if present
    const jsonText = rawText.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim()

    let parsed: { questions: Array<{ text: string; category: string }> }
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      console.error('Failed to parse Gemini response as JSON:', rawText)
      return new Response(
        JSON.stringify({ error: 'AI returned invalid JSON. Please try again.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!Array.isArray(parsed.questions)) {
      return new Response(
        JSON.stringify({ error: 'AI response missing questions array.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in generate-questions:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
