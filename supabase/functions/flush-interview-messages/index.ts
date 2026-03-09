import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    const kv = await Deno.openKv()

    // Get all interview metadata entries from KV
    const metadataEntries = kv.list({ prefix: ['interview_metadata'] })
    let flushedCount = 0
    let errorCount = 0

    for await (const entry of metadataEntries) {
      try {
        const userId = (entry.key[1] as string)
        const metadata = entry.value as {
          userId?: string
          jobDescription?: string
          companyName?: string
          interviewStyle?: string
        }

        if (!userId || !metadata.userId) {
          console.error(`Invalid userId for metadata entry`)
          continue
        }

        // Get messages from KV for this user
        const messagesKvKey = ['interview_messages', userId]
        const messagesEntry = await kv.get(messagesKvKey)
        const messages = (messagesEntry.value as string[]) || []

        if (messages.length === 0) {
          continue
        }

        // Create Supabase client with service role
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Generate a session ID based on user and company
        const sessionId = `interview-${userId}-${metadata.companyName?.replace(/\s+/g, '-').toLowerCase()}`

        // Check if session already exists
        const { data: existingSession, error: fetchError } = await supabase
          .from('research_sessions')
          .select('id, messages')
          .eq('id', sessionId)
          .single()

        if (existingSession) {
          // Update existing session - append messages
          const currentMessages = existingSession.messages || []
          const allMessages = Array.isArray(currentMessages) ? currentMessages : []

          const { error: updateError } = await supabase
            .from('research_sessions')
            .update({
              messages: [...allMessages, ...messages],
              updated_at: new Date().toISOString(),
            })
            .eq('id', sessionId)

          if (updateError) {
            console.error(`Error updating session ${sessionId}:`, updateError)
            errorCount++
            continue
          }
        } else {
          // Create new session
          const { error: insertError } = await supabase
            .from('research_sessions')
            .insert({
              id: sessionId,
              user_id: userId,
              title: `${metadata.companyName} - ${metadata.interviewStyle} Interview`,
              messages,
            })

          if (insertError) {
            console.error(`Error creating session ${sessionId}:`, insertError)
            errorCount++
            continue
          }
        }

        // Delete from KV after successful flush
        await kv.delete(['interview_messages', userId])
        flushedCount++
      } catch (error) {
        console.error(`Error flushing interview session:`, error)
        errorCount++
      }
    }

    kv.close()

    return new Response(
      JSON.stringify({
        success: true,
        flushedCount,
        errorCount,
        message: `Flushed ${flushedCount} interview sessions to database`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error in flush function:', error)
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
