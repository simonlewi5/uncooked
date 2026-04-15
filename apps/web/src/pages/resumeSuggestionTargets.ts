import type { ResumeDocument, ResumeTailorEdit } from '@/types'
import {
  insertBulletAfter,
  insertSkillAfter,
  removeBullet,
  removeSkill,
  updateBullet,
  updateEducationField,
  updateExperienceField,
  updateSkill,
  updateTextNode,
} from '@/lib/resumeMutations'

export type ResumeTargetSource = 'exact' | 'fallback'

export type ResumeTargetKind =
  | 'profile-name'
  | 'profile-contact'
  | 'profile-summary'
  | 'experience-field'
  | 'experience-bullet'
  | 'education-field'
  | 'skill'

export interface ResumeTargetResolution {
  targetId: string
  kind: ResumeTargetKind
  source: ResumeTargetSource
  currentText: string
  label: string
  sectionLabel: 'Summary' | 'Experience' | 'Skills' | 'Unmapped'
  entryId?: string
  field?: 'title' | 'company' | 'period' | 'degree' | 'school'
  bulletId?: string
  skillId?: string
}

export interface ResumeSuggestionViewModel {
  edit: ResumeTailorEdit
  targetId: string
  currentText: string | null
  replacementText: string
  targetExists: boolean
  targetLabel: string
  sectionLabel: 'Summary' | 'Experience' | 'Skills' | 'Unmapped'
  source: ResumeTargetSource | null
}

const EXACT_PROFILE_IDS = new Map<string, ResumeTargetKind>([
  ['profile/name', 'profile-name'],
  ['profile/contact', 'profile-contact'],
  ['profile/summary', 'profile-summary'],
])

export const normalizeTargetId = (id: string): string => id.trim()

const getTextLabel = (kind: ResumeTargetKind, field?: string): string => {
  if (kind === 'profile-name') return 'Name'
  if (kind === 'profile-contact') return 'Contact'
  if (kind === 'profile-summary') return 'Summary'
  if (kind === 'experience-bullet') return 'Experience bullet'
  if (kind === 'experience-field') {
    if (field === 'title') return 'Experience title'
    if (field === 'company') return 'Experience company'
    return 'Experience period'
  }
  if (kind === 'education-field') {
    if (field === 'degree') return 'Education degree'
    if (field === 'school') return 'Education school'
    return 'Education period'
  }
  if (kind === 'skill') return 'Skill'
  return 'Suggestion target'
}

const resolveExactTarget = (resumeContent: ResumeDocument, targetId: string): ResumeTargetResolution | null => {
  const normalizedTargetId = normalizeTargetId(targetId)

  const profileKind = EXACT_PROFILE_IDS.get(normalizedTargetId)
  if (profileKind === 'profile-name') {
    return {
      targetId: normalizedTargetId,
      kind: profileKind,
      source: 'exact',
      currentText: resumeContent.name.text,
      label: getTextLabel(profileKind),
      sectionLabel: 'Unmapped',
    }
  }
  if (profileKind === 'profile-contact') {
    return {
      targetId: normalizedTargetId,
      kind: profileKind,
      source: 'exact',
      currentText: resumeContent.contact.text,
      label: getTextLabel(profileKind),
      sectionLabel: 'Unmapped',
    }
  }
  if (profileKind === 'profile-summary') {
    return {
      targetId: normalizedTargetId,
      kind: profileKind,
      source: 'exact',
      currentText: resumeContent.summary.text,
      label: getTextLabel(profileKind),
      sectionLabel: 'Summary',
    }
  }

  const experienceFieldMatch = normalizedTargetId.match(/^experience\/(.+?)\/(title|company|period)$/)
  if (experienceFieldMatch) {
    const [, entryId, field] = experienceFieldMatch
    const entry = resumeContent.experience.find((candidate) => candidate.id === entryId)
    if (!entry) return null
    const fieldKey = field as 'title' | 'company' | 'period'
    return {
      targetId: normalizedTargetId,
      kind: 'experience-field',
      source: 'exact',
      entryId,
      field: fieldKey,
      currentText: entry[fieldKey].text,
      label: getTextLabel('experience-field', fieldKey),
      sectionLabel: 'Experience',
    }
  }

  const experienceBulletMatch = normalizedTargetId.match(/^experience\/(.+?)\/bullets\/(.+)$/)
  if (experienceBulletMatch) {
    const [, entryId] = experienceBulletMatch
    const entry = resumeContent.experience.find((candidate) => candidate.id === entryId)
    const bullet = entry?.bullets.find((candidate) => candidate.id === normalizedTargetId)
    if (!entry || !bullet) return null
    return {
      targetId: normalizedTargetId,
      kind: 'experience-bullet',
      source: 'exact',
      entryId,
      bulletId: normalizedTargetId,
      currentText: bullet.text,
      label: getTextLabel('experience-bullet'),
      sectionLabel: 'Experience',
    }
  }

  const educationFieldMatch = normalizedTargetId.match(/^education\/(.+?)\/(degree|school|period)$/)
  if (educationFieldMatch) {
    const [, entryId, field] = educationFieldMatch
    const entry = resumeContent.education.find((candidate) => candidate.id === entryId)
    if (!entry) return null
    const fieldKey = field as 'degree' | 'school' | 'period'
    return {
      targetId: normalizedTargetId,
      kind: 'education-field',
      source: 'exact',
      entryId,
      field: fieldKey,
      currentText: entry[fieldKey].text,
      label: getTextLabel('education-field', fieldKey),
      sectionLabel: 'Unmapped',
    }
  }

  const skillMatch = normalizedTargetId.match(/^skills\/(.+)$/)
  if (skillMatch) {
    const [, skillId] = skillMatch
    const skill = resumeContent.skills.find((candidate) => candidate.id === normalizedTargetId || candidate.id === skillId)
    if (!skill) return null
    return {
      targetId: normalizedTargetId,
      kind: 'skill',
      source: 'exact',
      skillId: skill.id,
      currentText: skill.text,
      label: getTextLabel('skill'),
      sectionLabel: 'Skills',
    }
  }

  return null
}

const resolveFallbackTarget = (resumeContent: ResumeDocument, targetId: string): ResumeTargetResolution | null => {
  const normalizedTargetId = normalizeTargetId(targetId)
  const leafId = normalizedTargetId.split('/').pop() ?? normalizedTargetId

  const allProfileTargets = [
    { id: 'profile/name', kind: 'profile-name' as const, text: resumeContent.name.text, label: 'Name' },
    { id: 'profile/contact', kind: 'profile-contact' as const, text: resumeContent.contact.text, label: 'Contact' },
    { id: 'profile/summary', kind: 'profile-summary' as const, text: resumeContent.summary.text, label: 'Summary' },
  ]

  const exactProfile = allProfileTargets.find((item) => item.id === normalizedTargetId || item.id.endsWith(`/${leafId}`))
  if (exactProfile) {
    return {
      targetId: exactProfile.id,
      kind: exactProfile.kind,
      source: 'fallback',
      currentText: exactProfile.text,
      label: exactProfile.label,
      sectionLabel: exactProfile.kind === 'profile-summary' ? 'Summary' : 'Unmapped',
    }
  }

  for (const entry of resumeContent.experience) {
    for (const field of ['title', 'company', 'period'] as const) {
      const fieldNode = entry[field]
      if (fieldNode.id === normalizedTargetId || fieldNode.id.endsWith(`/${leafId}`)) {
        return {
          targetId: fieldNode.id,
          kind: 'experience-field',
          source: 'fallback',
          entryId: entry.id,
          field,
          currentText: fieldNode.text,
          label: getTextLabel('experience-field', field),
          sectionLabel: 'Experience',
        }
      }
    }

    for (const bullet of entry.bullets) {
      if (bullet.id === normalizedTargetId || bullet.id.endsWith(`/${leafId}`)) {
        return {
          targetId: bullet.id,
          kind: 'experience-bullet',
          source: 'fallback',
          entryId: entry.id,
          bulletId: bullet.id,
          currentText: bullet.text,
          label: getTextLabel('experience-bullet'),
          sectionLabel: 'Experience',
        }
      }
    }
  }

  for (const entry of resumeContent.education) {
    for (const field of ['degree', 'school', 'period'] as const) {
      const fieldNode = entry[field]
      if (fieldNode.id === normalizedTargetId || fieldNode.id.endsWith(`/${leafId}`)) {
        return {
          targetId: fieldNode.id,
          kind: 'education-field',
          source: 'fallback',
          entryId: entry.id,
          field,
          currentText: fieldNode.text,
          label: getTextLabel('education-field', field),
          sectionLabel: 'Unmapped',
        }
      }
    }
  }

  const skill = resumeContent.skills.find((candidate) => candidate.id === normalizedTargetId || candidate.id.endsWith(`/${leafId}`))
  if (skill) {
    return {
      targetId: skill.id,
      kind: 'skill',
      source: 'fallback',
      skillId: skill.id,
      currentText: skill.text,
      label: getTextLabel('skill'),
      sectionLabel: 'Skills',
    }
  }

  return null
}

export const resolveTarget = (
  resumeContent: ResumeDocument,
  targetId: string
): ResumeTargetResolution | null => {
  return resolveExactTarget(resumeContent, targetId) ?? resolveFallbackTarget(resumeContent, targetId)
}

export const findSuggestionByTargetId = (
  edits: ResumeTailorEdit[],
  targetId: string
): ResumeTailorEdit | undefined => {
  const normalizedTargetId = normalizeTargetId(targetId)
  return edits.find((edit) => normalizeTargetId(edit.targetId) === normalizedTargetId)
}

export const removeSuggestionByTargetId = (edits: ResumeTailorEdit[], targetId: string): ResumeTailorEdit[] => {
  const normalizedTargetId = normalizeTargetId(targetId)
  return edits.filter((edit) => normalizeTargetId(edit.targetId) !== normalizedTargetId)
}

const sectionLabelFromEdit = (
  section: ResumeTailorEdit['section']
): ResumeSuggestionViewModel['sectionLabel'] => {
  if (section === 'summary') return 'Summary'
  if (section === 'skills') return 'Skills'
  return 'Experience'
}

export const buildResumeSuggestionViewModels = (
  resumeContent: ResumeDocument,
  edits: ResumeTailorEdit[]
): ResumeSuggestionViewModel[] => {
  return edits.map((edit) => {
    const resolution = resolveTarget(resumeContent, edit.targetId)
    return {
      edit,
      targetId: normalizeTargetId(edit.targetId),
      currentText: resolution?.currentText ?? null,
      replacementText: edit.replacement,
      targetExists: Boolean(resolution),
      targetLabel: resolution?.label ?? 'Removed target',
      sectionLabel: resolution?.sectionLabel ?? sectionLabelFromEdit(edit.section),
      source: resolution?.source ?? null,
    }
  })
}

export const applySuggestion = (
  resumeContent: ResumeDocument,
  edit: ResumeTailorEdit
): { nextContent: ResumeDocument; applied: boolean; targetResolution: ResumeTargetResolution | null } => {
  const targetResolution = resolveTarget(resumeContent, edit.targetId)
  if (!targetResolution) {
    return { nextContent: resumeContent, applied: false, targetResolution: null }
  }

  const { operation, replacement } = edit
  const ok = (nextContent: ResumeDocument) => ({ nextContent, applied: true, targetResolution })

  if (targetResolution.kind === 'profile-name') {
    if (operation === 'replace') return ok({ ...resumeContent, name: updateTextNode(resumeContent.name, replacement) })
    if (operation === 'insert') return ok({ ...resumeContent, name: updateTextNode(resumeContent.name, `${resumeContent.name.text} ${replacement}`.trim()) })
    return ok({ ...resumeContent, name: updateTextNode(resumeContent.name, '') })
  }

  if (targetResolution.kind === 'profile-contact') {
    if (operation === 'replace') return ok({ ...resumeContent, contact: updateTextNode(resumeContent.contact, replacement) })
    if (operation === 'insert') return ok({ ...resumeContent, contact: updateTextNode(resumeContent.contact, `${resumeContent.contact.text} ${replacement}`.trim()) })
    return ok({ ...resumeContent, contact: updateTextNode(resumeContent.contact, '') })
  }

  if (targetResolution.kind === 'profile-summary') {
    if (operation === 'replace') return ok({ ...resumeContent, summary: updateTextNode(resumeContent.summary, replacement) })
    if (operation === 'insert') return ok({ ...resumeContent, summary: updateTextNode(resumeContent.summary, `${resumeContent.summary.text}\n${replacement}`.trim()) })
    return ok({ ...resumeContent, summary: updateTextNode(resumeContent.summary, '') })
  }

  if (targetResolution.kind === 'experience-field' && targetResolution.entryId && targetResolution.field) {
    const fieldKey = targetResolution.field as 'title' | 'company' | 'period'
    const currentText = targetResolution.currentText
    if (operation === 'replace') return ok(updateExperienceField(resumeContent, targetResolution.entryId, fieldKey, replacement))
    if (operation === 'insert') return ok(updateExperienceField(resumeContent, targetResolution.entryId, fieldKey, `${currentText} ${replacement}`.trim()))
    return ok(updateExperienceField(resumeContent, targetResolution.entryId, fieldKey, ''))
  }

  if (targetResolution.kind === 'experience-bullet' && targetResolution.entryId && targetResolution.bulletId) {
    if (operation === 'replace') return ok(updateBullet(resumeContent, targetResolution.entryId, targetResolution.bulletId, replacement))
    if (operation === 'insert') return ok(insertBulletAfter(resumeContent, targetResolution.entryId, targetResolution.bulletId, replacement))
    return ok(removeBullet(resumeContent, targetResolution.entryId, targetResolution.bulletId))
  }

  if (targetResolution.kind === 'education-field' && targetResolution.entryId && targetResolution.field) {
    const fieldKey = targetResolution.field as 'degree' | 'school' | 'period'
    const currentText = targetResolution.currentText
    if (operation === 'replace') return ok(updateEducationField(resumeContent, targetResolution.entryId, fieldKey, replacement))
    if (operation === 'insert') return ok(updateEducationField(resumeContent, targetResolution.entryId, fieldKey, `${currentText} ${replacement}`.trim()))
    return ok(updateEducationField(resumeContent, targetResolution.entryId, fieldKey, ''))
  }

  if (targetResolution.kind === 'skill' && targetResolution.skillId) {
    const index = resumeContent.skills.findIndex((skill) => skill.id === targetResolution.skillId)
    if (index === -1) return { nextContent: resumeContent, applied: false, targetResolution: null }
    if (operation === 'replace') return ok(updateSkill(resumeContent, targetResolution.skillId, replacement))
    if (operation === 'insert') return ok(insertSkillAfter(resumeContent, targetResolution.skillId, replacement))
    return ok(removeSkill(resumeContent, targetResolution.skillId))
  }

  return { nextContent: resumeContent, applied: false, targetResolution: null }
}
