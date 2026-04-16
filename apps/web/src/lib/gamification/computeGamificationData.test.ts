import { describe, it, expect } from 'vitest'
import { GAMIFICATION_EVENT_TYPES, getXpForEventType } from './eventCatalog'
import {
  computeGamificationData,
  countEventsByType,
  sumLedgerXp,
  XP_PER_APPLICATION,
  XP_PER_PRACTICE,
  XP_PER_RESEARCH,
} from './computeGamificationData'

describe('eventCatalog (resume actions)', () => {
  it('maps each resume event type to its configured XP', () => {
    expect(getXpForEventType(GAMIFICATION_EVENT_TYPES.RESUME_SESSION_UPLOAD)).toBe(30)
    expect(getXpForEventType(GAMIFICATION_EVENT_TYPES.RESUME_AUTO_TAILOR)).toBe(40)
    expect(getXpForEventType(GAMIFICATION_EVENT_TYPES.RESUME_APPLY_TAILOR_EDIT)).toBe(15)
    expect(getXpForEventType(GAMIFICATION_EVENT_TYPES.RESUME_DECLINE_TAILOR_EDIT)).toBe(10)
  })
})

describe('computeGamificationData', () => {
  it('sums resume ledger rows into total XP', () => {
    const data = computeGamificationData({
      practiceCount: 0,
      researchCount: 0,
      applicationCount: 0,
      xpEvents: [
        { event_type: GAMIFICATION_EVENT_TYPES.RESUME_SESSION_UPLOAD, xp_awarded: 30 },
        { event_type: GAMIFICATION_EVENT_TYPES.RESUME_AUTO_TAILOR, xp_awarded: 40 },
        { event_type: GAMIFICATION_EVENT_TYPES.RESUME_APPLY_TAILOR_EDIT, xp_awarded: 15 },
        { event_type: GAMIFICATION_EVENT_TYPES.RESUME_DECLINE_TAILOR_EDIT, xp_awarded: 10 },
      ],
    })
    expect(data.totalXp).toBe(95)
  })

  it('adds session-table XP and ledger XP', () => {
    const data = computeGamificationData({
      practiceCount: 2,
      researchCount: 1,
      applicationCount: 1,
      xpEvents: [{ event_type: GAMIFICATION_EVENT_TYPES.RESUME_AUTO_TAILOR, xp_awarded: 40 }],
    })
    expect(data.totalXp).toBe(
      2 * XP_PER_PRACTICE + 1 * XP_PER_RESEARCH + 1 * XP_PER_APPLICATION + 40,
    )
  })

  it('earns resume_on_file after one upload event', () => {
    const data = computeGamificationData({
      practiceCount: 0,
      researchCount: 0,
      applicationCount: 0,
      xpEvents: [{ event_type: GAMIFICATION_EVENT_TYPES.RESUME_SESSION_UPLOAD, xp_awarded: 30 }],
    })
    expect(data.badges.find((b) => b.id === 'resume_on_file')?.earned).toBe(true)
    expect(data.badges.find((b) => b.id === 'tailor_pilot')?.earned).toBe(false)
  })

  it('earns edit_adopter after five apply events', () => {
    const applies = Array.from({ length: 5 }, () => ({
      event_type: GAMIFICATION_EVENT_TYPES.RESUME_APPLY_TAILOR_EDIT,
      xp_awarded: 15,
    }))
    const data = computeGamificationData({
      practiceCount: 0,
      researchCount: 0,
      applicationCount: 0,
      xpEvents: applies,
    })
    expect(data.badges.find((b) => b.id === 'edit_adopter')?.earned).toBe(true)
    expect(countEventsByType(applies, GAMIFICATION_EVENT_TYPES.RESUME_APPLY_TAILOR_EDIT)).toBe(5)
  })

  it('sumLedgerXp aggregates xp_awarded', () => {
    const rows = [
      { event_type: GAMIFICATION_EVENT_TYPES.INTERVIEW_MESSAGE, xp_awarded: 1 },
      { event_type: GAMIFICATION_EVENT_TYPES.RESUME_SESSION_UPLOAD, xp_awarded: 30 },
    ]
    expect(sumLedgerXp(rows)).toBe(31)
  })
})
