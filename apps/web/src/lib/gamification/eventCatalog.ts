/** String identifiers for `user_xp_events.event_type`; XP amounts live in `XP_BY_EVENT_TYPE`. */
export const GAMIFICATION_EVENT_TYPES = {
  INTERVIEW_START: 'interview_start',
  INTERVIEW_MESSAGE: 'interview_message',
  INTERVIEW_MILESTONE_5: 'interview_milestone_5',
  INTERVIEW_MILESTONE_10: 'interview_milestone_10',
  RESUME_SESSION_UPLOAD: 'resume_session_upload',
  RESUME_AUTO_TAILOR: 'resume_auto_tailor',
  RESUME_APPLY_TAILOR_EDIT: 'resume_apply_tailor_edit',
  RESUME_DECLINE_TAILOR_EDIT: 'resume_decline_tailor_edit',
} as const

export type ResumeGamificationEventType =
  | typeof GAMIFICATION_EVENT_TYPES.RESUME_SESSION_UPLOAD
  | typeof GAMIFICATION_EVENT_TYPES.RESUME_AUTO_TAILOR
  | typeof GAMIFICATION_EVENT_TYPES.RESUME_APPLY_TAILOR_EDIT
  | typeof GAMIFICATION_EVENT_TYPES.RESUME_DECLINE_TAILOR_EDIT

/** Must match `xp_awarded` written at insert time (see `useInterviewChat`, `recordXpEvent`). */
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

const RESUME_TOAST_TITLE: Partial<Record<ResumeGamificationEventType, string>> = {
  [GAMIFICATION_EVENT_TYPES.RESUME_SESSION_UPLOAD]: 'Resume uploaded',
  [GAMIFICATION_EVENT_TYPES.RESUME_AUTO_TAILOR]: 'Auto-Tailor run',
  [GAMIFICATION_EVENT_TYPES.RESUME_APPLY_TAILOR_EDIT]: 'Suggestion applied',
  [GAMIFICATION_EVENT_TYPES.RESUME_DECLINE_TAILOR_EDIT]: 'Suggestion declined',
}

export function getXpForEventType(eventType: string): number {
  return XP_BY_EVENT_TYPE[eventType] ?? 0
}

export function getResumeToastTitle(eventType: ResumeGamificationEventType): string {
  return RESUME_TOAST_TITLE[eventType] ?? 'Progress saved'
}
