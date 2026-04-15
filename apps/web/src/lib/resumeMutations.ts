import type { ResumeDocument } from '@/types'

export const updateTextNode = <T extends { text: string }>(node: T, text: string): T => ({
  ...node,
  text,
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
          bullets: entry.bullets.map((bullet) => (bullet.id === bulletId ? updateTextNode(bullet, text) : bullet)),
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
      id: `experience/${entryId}/bullets/${crypto.randomUUID().replace(/-/g, '')}`,
      text,
    })

    return { ...entry, bullets: nextBullets }
  }),
})

export const removeBullet = (resumeContent: ResumeDocument, entryId: string, bulletId: string): ResumeDocument => ({
  ...resumeContent,
  experience: resumeContent.experience.map((entry) =>
    entry.id === entryId ? { ...entry, bullets: entry.bullets.filter((bullet) => bullet.id !== bulletId) } : entry
  ),
})

export const updateSkill = (resumeContent: ResumeDocument, skillId: string, text: string): ResumeDocument => ({
  ...resumeContent,
  skills: resumeContent.skills.map((skill) => (skill.id === skillId ? updateTextNode(skill, text) : skill)),
})

export const insertSkillAfter = (resumeContent: ResumeDocument, skillId: string, text: string): ResumeDocument => {
  const index = resumeContent.skills.findIndex((skill) => skill.id === skillId)
  if (index === -1) return resumeContent

  const nextSkills = [
    ...resumeContent.skills.slice(0, index + 1),
    { id: `skills/${crypto.randomUUID().replace(/-/g, '')}`, text },
    ...resumeContent.skills.slice(index + 1),
  ]

  return { ...resumeContent, skills: nextSkills }
}

export const removeSkill = (resumeContent: ResumeDocument, skillId: string): ResumeDocument => ({
  ...resumeContent,
  skills: resumeContent.skills.filter((skill) => skill.id !== skillId),
})