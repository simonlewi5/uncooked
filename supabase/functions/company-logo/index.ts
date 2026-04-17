import { corsHeaders } from '../_shared/cors.ts'

function cleanDomain(input: string): string {
  if (!input) return '';
  
  try {
    let clean = input.toLowerCase().trim();
    clean = clean.replace(/^https?:\/\//, '');
    clean = clean.replace(/^www\./, '');

    clean = clean.split('/')[0];
    clean = clean.split('?')[0].split('#')[0];

    return clean;
  } catch {
    return input.trim();
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const rawDomain = url.searchParams.get('domain')?.trim()

    if (!rawDomain) {
      return new Response('Missing domain query parameter', {
        status: 400,
        headers: corsHeaders,
      })
    }

    const domain = cleanDomain(rawDomain);
    const googleFaviconUrl = `https://s2.googleusercontent.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`
    const logoResponse = await fetch(googleFaviconUrl);

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