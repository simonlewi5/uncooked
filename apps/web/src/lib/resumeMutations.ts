import type { ResumeDocument } from '@/types'

// ── ID format (single source of truth) ─────────────────────────────────────
// All resume field IDs are derived from these generators. Any code that reads
// or writes IDs (mutations, hydration, target resolution) must use these so
// the format never diverges.
export const ID_GENERATORS = {
  profileName: () => 'profile/name',
  profileContact: () => 'profile/contact',
  summary: () => 'profile/summary',
  experienceField: (entryId: string, field: 'title' | 'company' | 'period') =>
    `experience/${entryId}/${field}`,
  experienceBullet: (entryId: string, bulletId: string) =>
    `experience/${entryId}/bullets/${bulletId}`,
  educationField: (entryId: string, field: 'degree' | 'school' | 'period') =>
    `education/${entryId}/${field}`,
  skillItem: (skillId: string) => `skills/${skillId}`,
}

const createId = () => crypto.randomUUID().replace(/-/g, '')

// ── Text node updates ───────────────────────────────────────────────────────

export const updateTextNode = <T extends { text: string }>(node: T, text: string): T => ({
  ...node,
  text,
})

export const updateProfileField = (
  resumeContent: ResumeDocument,
  field: 'name' | 'contact',
  text: string
): ResumeDocument => ({
  ...resumeContent,
  [field]: updateTextNode(resumeContent[field], text),
})

export const updateSummary = (resumeContent: ResumeDocument, text: string): ResumeDocument => ({
  ...resumeContent,
  summary: updateTextNode(resumeContent.summary, text),
})

export const updateExperienceField = (
  resumeContent: ResumeDocument,
  entryId: string,
  field: 'title' | 'company' | 'period',
  text: string
): ResumeDocument => ({
  ...resumeContent,
  experience: resumeContent.experience.map((entry) =>
    entry.id === entryId ? { ...entry, [field]: updateTextNode(entry[field], text) } : entry
  ),
})

export const updateEducationField = (
  resumeContent: ResumeDocument,
  entryId: string,
  field: 'degree' | 'school' | 'period',
  text: string
): ResumeDocument => ({
  ...resumeContent,
  education: resumeContent.education.map((entry) =>
    entry.id === entryId ? { ...entry, [field]: updateTextNode(entry[field], text) } : entry
  ),
})

export const updateBullet = (
  resumeContent: ResumeDocument,
  entryId: string,
  bulletId: string,
  text: string
): ResumeDocument => ({
  ...resumeContent,
  experience: resumeContent.experience.map((entry) =>
    entry.id === entryId
      ? {
          ...entry,
          bullets: entry.bullets.map((bullet) =>
            bullet.id === bulletId ? updateTextNode(bullet, text) : bullet
          ),
        }
      : entry
  ),
})

export const insertBulletAfter = (
  resumeContent: ResumeDocument,
  entryId: string,
  bulletId: string,
  text: string
): ResumeDocument => ({
  ...resumeContent,
  experience: resumeContent.experience.map((entry) => {
    if (entry.id !== entryId) return entry

    const insertIndex = entry.bullets.findIndex((bullet) => bullet.id === bulletId)
    if (insertIndex === -1) return entry

    const nextBullets = [...entry.bullets]
    nextBullets.splice(insertIndex + 1, 0, {
      id: ID_GENERATORS.experienceBullet(entryId, createId()),
      text,
    })

    return { ...entry, bullets: nextBullets }
  }),
})

export const removeBullet = (
  resumeContent: ResumeDocument,
  entryId: string,
  bulletId: string
): ResumeDocument => ({
  ...resumeContent,
  experience: resumeContent.experience.map((entry) =>
    entry.id === entryId
      ? { ...entry, bullets: entry.bullets.filter((bullet) => bullet.id !== bulletId) }
      : entry
  ),
})

export const updateSkill = (
  resumeContent: ResumeDocument,
  skillId: string,
  text: string
): ResumeDocument => ({
  ...resumeContent,
  skills: resumeContent.skills.map((skill) =>
    skill.id === skillId ? updateTextNode(skill, text) : skill
  ),
})

export const insertSkillAfter = (
  resumeContent: ResumeDocument,
  skillId: string,
  text: string
): ResumeDocument => {
  const index = resumeContent.skills.findIndex((skill) => skill.id === skillId)
  if (index === -1) return resumeContent

  const nextSkills = [
    ...resumeContent.skills.slice(0, index + 1),
    { id: ID_GENERATORS.skillItem(createId()), text },
    ...resumeContent.skills.slice(index + 1),
  ]

  return { ...resumeContent, skills: nextSkills }
}

export const removeSkill = (resumeContent: ResumeDocument, skillId: string): ResumeDocument => ({
  ...resumeContent,
  skills: resumeContent.skills.filter((skill) => skill.id !== skillId),
})

// ── Entry constructors ──────────────────────────────────────────────────────

export const addExperienceEntry = (resumeContent: ResumeDocument): ResumeDocument => {
  const id = crypto.randomUUID()
  return {
    ...resumeContent,
    experience: [
      ...resumeContent.experience,
      {
        id,
        title: { id: ID_GENERATORS.experienceField(id, 'title'), text: 'Job Title' },
        company: { id: ID_GENERATORS.experienceField(id, 'company'), text: 'Company Name' },
        period: { id: ID_GENERATORS.experienceField(id, 'period'), text: 'Year – Year' },
        bullets: [{ id: ID_GENERATORS.experienceBullet(id, `b${createId()}`), text: 'Describe your responsibilities here.' }],
      },
    ],
  }
}

export const addBulletToEntry = (resumeContent: ResumeDocument, expId: string): ResumeDocument => ({
  ...resumeContent,
  experience: resumeContent.experience.map((entry) =>
    entry.id === expId
      ? {
          ...entry,
          bullets: [
            ...entry.bullets,
            { id: ID_GENERATORS.experienceBullet(expId, `b${createId()}`), text: 'New bullet point.' },
          ],
        }
      : entry
  ),
})

export const addEducationEntry = (resumeContent: ResumeDocument): ResumeDocument => {
  const id = crypto.randomUUID()
  return {
    ...resumeContent,
    education: [
      ...resumeContent.education,
      {
        id,
        degree: { id: ID_GENERATORS.educationField(id, 'degree'), text: 'Degree / Certification' },
        school: { id: ID_GENERATORS.educationField(id, 'school'), text: 'Institution Name' },
        period: { id: ID_GENERATORS.educationField(id, 'period'), text: 'Year – Year' },
      },
    ],
  }
}

// ── Document hydration ──────────────────────────────────────────────────────

/**
 * Normalize a parsed or stored ResumeDocument to canonical field IDs.
 * Trims stored IDs and falls back to the generated canonical form when a
 * stored ID is blank, ensuring target resolution always has a stable address.
 */
export const normalizeResumeDocument = (content: ResumeDocument): ResumeDocument => {
  const canonical = (id: string, fallback: string) => id.trim() || fallback
  return {
    name: { id: canonical(content.name.id, ID_GENERATORS.profileName()), text: content.name.text },
    contact: { id: canonical(content.contact.id, ID_GENERATORS.profileContact()), text: content.contact.text },
    summary: { id: canonical(content.summary.id, ID_GENERATORS.summary()), text: content.summary.text },
    experience: content.experience.map((entry) => ({
      id: entry.id,
      title: {
        id: canonical(entry.title.id, ID_GENERATORS.experienceField(entry.id, 'title')),
        text: entry.title.text,
      },
      company: {
        id: canonical(entry.company.id, ID_GENERATORS.experienceField(entry.id, 'company')),
        text: entry.company.text,
      },
      period: {
        id: canonical(entry.period.id, ID_GENERATORS.experienceField(entry.id, 'period')),
        text: entry.period.text,
      },
      bullets: entry.bullets.map((bullet, index) => ({
        id: canonical(bullet.id, ID_GENERATORS.experienceBullet(entry.id, `b${index + 1}`)),
        text: bullet.text,
      })),
    })),
    education: content.education.map((entry) => ({
      id: entry.id,
      degree: {
        id: canonical(entry.degree.id, ID_GENERATORS.educationField(entry.id, 'degree')),
        text: entry.degree.text,
      },
      school: {
        id: canonical(entry.school.id, ID_GENERATORS.educationField(entry.id, 'school')),
        text: entry.school.text,
      },
      period: {
        id: canonical(entry.period.id, ID_GENERATORS.educationField(entry.id, 'period')),
        text: entry.period.text,
      },
    })),
    skills: content.skills.map((skill, index) => ({
      id: canonical(skill.id, ID_GENERATORS.skillItem(`s${index + 1}`)),
      text: skill.text,
    })),
  }
}
