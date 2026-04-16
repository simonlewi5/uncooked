import { supabase } from '@/lib/supabase'
import type { GamificationSources } from './computeGamificationData'

export async function fetchGamificationSources(userId: string): Promise<GamificationSources | null> {
  const [practiceResult, researchResult, applicationsResult, xpEventsResult] = await Promise.all([
    supabase
      .from('practice_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('research_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('job_applications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase.from('user_xp_events').select('xp_awarded, event_type').eq('user_id', userId),
  ])

  if (practiceResult.error || researchResult.error || applicationsResult.error || xpEventsResult.error) {
    return null
  }

  return {
    practiceCount: practiceResult.count ?? 0,
    researchCount: researchResult.count ?? 0,
    applicationCount: applicationsResult.count ?? 0,
    xpEvents: (xpEventsResult.data ?? []) as GamificationSources['xpEvents'],
  }
}
