import type { Badge } from '@/types'
import { getXpForEventType } from './eventCatalog'
import { computeGamificationData, diffNewlyEarnedBadges } from './computeGamificationData'
import { fetchGamificationSources } from './fetchGamificationSources'
import { recordXpEvent } from './recordXpEvent'

export interface AwardGamificationResult {
  success: boolean
  xpAwarded: number
  newBadges: Badge[]
}

/**
 * Records an XP event and returns newly unlocked badges by diffing gamification state.
 * Runs multiple queries — always call without blocking the UI (`void awardGamificationEvent(...)`).
 */
export async function awardGamificationEvent(
  userId: string,
  eventType: string,
  options?: { referenceId?: string | null },
): Promise<AwardGamificationResult> {
  const xpAwarded = getXpForEventType(eventType)
  if (xpAwarded <= 0) {
    return { success: false, xpAwarded: 0, newBadges: [] }
  }

  const beforeSources = await fetchGamificationSources(userId)
  if (!beforeSources) {
    return { success: false, xpAwarded: 0, newBadges: [] }
  }
  const beforeData = computeGamificationData(beforeSources)

  const ok = await recordXpEvent({
    userId,
    eventType,
    referenceId: options?.referenceId,
  })
  if (!ok) {
    return { success: false, xpAwarded: 0, newBadges: [] }
  }

  const afterSources = await fetchGamificationSources(userId)
  if (!afterSources) {
    return { success: true, xpAwarded, newBadges: [] }
  }
  const afterData = computeGamificationData(afterSources)
  const newBadges = diffNewlyEarnedBadges(beforeData, afterData)

  return { success: true, xpAwarded, newBadges }
}
