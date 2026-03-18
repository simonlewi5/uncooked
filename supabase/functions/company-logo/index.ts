import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const domain = url.searchParams.get('domain')?.trim()

    if (!domain) {
      return new Response('Missing domain query parameter', {
        status: 400,
        headers: corsHeaders,
      })
    }

    const clearbitUrl = `https://logo.clearbit.com/${encodeURIComponent(domain)}`

    const logoResponse = await fetch(clearbitUrl, {
      headers: {
        'User-Agent': 'Uncooked-Logo-Proxy',
      },
    })

    if (!logoResponse.ok) {
      return new Response('Logo not found', {
        status: logoResponse.status,
        headers: corsHeaders,
      })
    }

    const contentType = logoResponse.headers.get('content-type') || 'image/png'
    const body = await logoResponse.arrayBuffer()

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  }
})