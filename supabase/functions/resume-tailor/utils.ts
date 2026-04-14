import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

declare const Deno: {
  env: {
    get: (key: string) => string | undefined
  }
}

export const DEBUG_ENABLED = Deno.env.get('RESUME_TAILOR_DEBUG') === 'true'
export const DEBUG_VERBOSE = Deno.env.get('RESUME_TAILOR_DEBUG_VERBOSE') === 'true'

export const toDebugPreview = (value: unknown, maxChars = 1500): string => {
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    if (serialized.length <= maxChars) return serialized
    return `${serialized.slice(0, maxChars)}... [truncated ${serialized.length - maxChars} chars]`
  } catch {
    return '[unserializable]'
  }
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
