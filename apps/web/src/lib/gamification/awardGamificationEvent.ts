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

function failed(): AwardGamificationResult {
  return { success: false, xpAwarded: 0, newBadges: [] }
}

/**
 * Snapshot → ledger insert → snapshot; returns badges newly earned in this transition.
 * Intended to be invoked as `void awardGamificationEvent(...)` so UI stays responsive.
 */
export async function awardGamificationEvent(
  userId: string,
  eventType: string,
  options?: { referenceId?: string | null },
): Promise<AwardGamificationResult> {
  const xpAwarded = getXpForEventType(eventType)
  if (xpAwarded <= 0) return failed()

  const beforeSrc = await fetchGamificationSources(userId)
  if (!beforeSrc) return failed()
  const before = computeGamificationData(beforeSrc)

  if (!(await recordXpEvent({ userId, eventType, referenceId: options?.referenceId }))) return failed()

  const afterSrc = await fetchGamificationSources(userId)
  if (!afterSrc) return { success: true, xpAwarded, newBadges: [] }

  return {
    success: true,
    xpAwarded,
    newBadges: diffNewlyEarnedBadges(before, computeGamificationData(afterSrc)),
  }
}
