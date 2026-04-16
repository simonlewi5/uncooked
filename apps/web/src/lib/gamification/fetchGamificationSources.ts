import { supabase } from '@/lib/supabase'
import type { GamificationSources } from './computeGamificationData'

export async function fetchGamificationSources(userId: string): Promise<GamificationSources | null> {
  const [practice, research, applications, xpEvents] = await Promise.all([
    supabase.from('practice_sessions').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('research_sessions').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('job_applications').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('user_xp_events').select('xp_awarded, event_type').eq('user_id', userId),
  ])

  if (practice.error || research.error || applications.error || xpEvents.error) return null

  return {
    practiceCount: practice.count ?? 0,
    researchCount: research.count ?? 0,
    applicationCount: applications.count ?? 0,
    xpEvents: (xpEvents.data ?? []) as GamificationSources['xpEvents'],
  }
}
