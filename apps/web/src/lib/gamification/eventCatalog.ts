/**
 * Central catalog for gamification event types and XP amounts.
 * Add new keys here when introducing additional tracked actions.
 */
export const GAMIFICATION_EVENT_TYPES = {
  /** Interview session started (existing) */
  INTERVIEW_START: 'interview_start',
  INTERVIEW_MESSAGE: 'interview_message',
  INTERVIEW_MILESTONE_5: 'interview_milestone_5',
  INTERVIEW_MILESTONE_10: 'interview_milestone_10',
  /** Resume tailoring workflow */
  RESUME_SESSION_UPLOAD: 'resume_session_upload',
  RESUME_AUTO_TAILOR: 'resume_auto_tailor',
  RESUME_APPLY_TAILOR_EDIT: 'resume_apply_tailor_edit',
  RESUME_DECLINE_TAILOR_EDIT: 'resume_decline_tailor_edit',
} as const

export type ResumeGamificationEventType =
  (typeof GAMIFICATION_EVENT_TYPES)[keyof Pick<
    typeof GAMIFICATION_EVENT_TYPES,
    | 'RESUME_SESSION_UPLOAD'
    | 'RESUME_AUTO_TAILOR'
    | 'RESUME_APPLY_TAILOR_EDIT'
    | 'RESUME_DECLINE_TAILOR_EDIT'
  >]

/** XP granted per event insert (must match insert payloads). */
export const XP_BY_EVENT_TYPE: Record<string, number> = {
  [GAMIFICATION_EVENT_TYPES.INTERVIEW_START]: 5,
  [GAMIFICATION_EVENT_TYPES.INTERVIEW_MESSAGE]: 1,
  [GAMIFICATION_EVENT_TYPES.INTERVIEW_MILESTONE_5]: 5,
  [GAMIFICATION_EVENT_TYPES.INTERVIEW_MILESTONE_10]: 10,
  [GAMIFICATION_EVENT_TYPES.RESUME_SESSION_UPLOAD]: 30,
  [GAMIFICATION_EVENT_TYPES.RESUME_AUTO_TAILOR]: 40,
  [GAMIFICATION_EVENT_TYPES.RESUME_APPLY_TAILOR_EDIT]: 15,
  [GAMIFICATION_EVENT_TYPES.RESUME_DECLINE_TAILOR_EDIT]: 10,
}

export const TOAST_TITLE_BY_EVENT_TYPE: Record<string, string> = {
  [GAMIFICATION_EVENT_TYPES.RESUME_SESSION_UPLOAD]: 'Resume uploaded',
  [GAMIFICATION_EVENT_TYPES.RESUME_AUTO_TAILOR]: 'Auto-Tailor run',
  [GAMIFICATION_EVENT_TYPES.RESUME_APPLY_TAILOR_EDIT]: 'Suggestion applied',
  [GAMIFICATION_EVENT_TYPES.RESUME_DECLINE_TAILOR_EDIT]: 'Suggestion declined',
}

export function getXpForEventType(eventType: string): number {
  return XP_BY_EVENT_TYPE[eventType] ?? 0
}

export function getResumeToastTitle(eventType: ResumeGamificationEventType): string {
  return TOAST_TITLE_BY_EVENT_TYPE[eventType] ?? 'Progress saved'
}
