import { supabase } from '@/lib/supabase'
import { getXpForEventType } from './eventCatalog'

export interface RecordXpEventParams {
  userId: string
  eventType: string
  referenceId?: string | null
}

/** Inserts one `user_xp_events` row. Prefer `awardGamificationEvent` when UI needs badge diff. */
export async function recordXpEvent(params: RecordXpEventParams): Promise<boolean> {
  const xp = getXpForEventType(params.eventType)
  if (xp <= 0) return false

  const { error } = await supabase.from('user_xp_events').insert({
    user_id: params.userId,
    event_type: params.eventType,
    xp_awarded: xp,
    reference_id: params.referenceId ?? undefined,
  })

  if (error) {
    console.error('recordXpEvent', params.eventType, error.message)
    return false
  }
  return true
}
