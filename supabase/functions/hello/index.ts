// Placeholder edge function — replace with real endpoints as they are built.
// See issues #20 (job description AI), #21 (chat AI), #30 (research board AI), #32 (auto-tailor)
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  return new Response(JSON.stringify({ message: 'Hello from Uncooked!' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
