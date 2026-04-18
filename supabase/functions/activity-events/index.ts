import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import postgres from 'npm:postgres@3.4.4'
import { handleActivityEvents } from './handler.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const dbUrl = Deno.env.get('SUPABASE_DB_URL') ?? Deno.env.get('DATABASE_URL') ?? ''
const sql = dbUrl
  ? postgres(dbUrl, {
      prepare: false,
      max: 1,
      idle_timeout: 5,
      connect_timeout: 5,
    })
  : null

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
      if (!sql) {
        console.error('activity-events refresh skipped: missing SUPABASE_DB_URL/DATABASE_URL')
        return
      }

      try {
        await sql.unsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY public.practice_sessions_v2;')
      } catch (error) {
        console.error('activity-events refresh failed:', error)
      }
    },
  })
})
