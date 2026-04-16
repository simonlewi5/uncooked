import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handleActivityEvents } from './handler.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

Deno.serve(async (req: Request) => {
  return handleActivityEvents(req, {
    getUserFromAuth: async (authHeader: string) => {
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      })

      const {
        data: { user },
        error,
      } = await authClient.auth.getUser()

      if (error || !user) return null
      return { id: user.id }
    },
    insertEvent: async (payload) => {
      const adminClient = createClient(supabaseUrl, serviceRoleKey)

      const { data, error } = await adminClient
        .from('activity_events')
        .insert(payload)
        .select('id, created_at')
        .single()

      if (error || !data) {
        throw new Error(error?.message ?? 'activity insert failed')
      }

      return {
        id: String(data.id),
        created_at: String(data.created_at),
      }
    },
    refreshSessions: async () => {
      const adminClient = createClient(supabaseUrl, serviceRoleKey)
      const { error } = await adminClient.rpc('refresh_practice_sessions_v2_concurrently')
      if (error) {
        throw new Error(error.message)
      }
    },
  })
})
