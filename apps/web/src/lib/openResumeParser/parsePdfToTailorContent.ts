import type { ResumeDocument, ResumeParseResponse } from '@/types'
import { extractEducation } from './extractEducation'
import { extractProfile } from './extractProfile'
import { extractSkills } from './extractSkills'
import { extractWorkExperience } from './extractWorkExperience'
import { groupLinesIntoSections } from './groupLinesIntoSections'
import { groupTextItemsIntoLines } from './groupTextItemsIntoLines'
import { readPdf } from './readPdf'
import { isValidSkill } from './normalizeSkills'

function sanitizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function compact(values: Array<string | null | undefined>): string {
  return values
    .map((value) => sanitizeText(value ?? ''))
    .filter(Boolean)
    .join(' • ')
}

export async function parsePdfToTailorContent(file: File): Promise<ResumeParseResponse> {
  const textItems = await readPdf(file)
  const lines = groupTextItemsIntoLines(textItems)
  const sections = groupLinesIntoSections(lines)

  const profile = extractProfile(sections)
  const experiences = extractWorkExperience(sections)
  const educations = extractEducation(sections)
  const skills = extractSkills(sections)

  const warnings: ResumeParseResponse['warnings'] = []

  if (!profile.name) {
    warnings?.push({ code: 'missing_name', message: 'Could not confidently detect candidate name.' })
  }

  if (experiences.length === 0) {
    warnings?.push({
      code: 'missing_experience',
      message: 'Could not reliably detect Experience section; please review manually.',
    })
  }

  // Deduplicate and validate skills, preserving order
  const uniqueSkills = new Map<string, string>()
  const allSkills = [...skills.featuredSkills, ...skills.descriptions]

  for (const skill of allSkills) {
    if (isValidSkill(skill)) {
      const normalized = skill.toLowerCase()
      if (!uniqueSkills.has(normalized)) {
        uniqueSkills.set(normalized, skill)
      }
    }
  }

  const structuredContent: ResumeDocument = {
    name: { id: 'profile/name', text: sanitizeText(profile.name) || 'Unknown Candidate' },
    contact: {
      id: 'profile/contact',
      text: compact([profile.email, profile.phone, profile.location, profile.url]),
    },
    summary: {
      id: 'profile/summary',
      text: sanitizeText(profile.summary),
    },
    experience: experiences.map((entry, index) => {
      const id = `e${index + 1}`
      const bullets = entry.descriptions
        .filter(Boolean)
        .map((text, bulletIndex) => ({
          id: `experience/${id}/bullets/b${bulletIndex + 1}`,
          text: sanitizeText(text),
        }))

      return {
        id,
        title: { id: `experience/${id}/title`, text: sanitizeText(entry.jobTitle) },
        company: { id: `experience/${id}/company`, text: sanitizeText(entry.company) },
        period: { id: `experience/${id}/period`, text: sanitizeText(entry.date) },
        bullets,
      }
    }),
    education: educations.map((entry, index) => {
      const id = `ed${index + 1}`
      return {
        id,
        degree: { id: `education/${id}/degree`, text: sanitizeText(entry.degree) },
        school: { id: `education/${id}/school`, text: sanitizeText(entry.school) },
        period: { id: `education/${id}/period`, text: sanitizeText(entry.date) },
      }
    }),
    skills: Array.from(uniqueSkills.values())
      .slice(0, 30)
      .map((text, index) => ({ id: `skills/s${index + 1}`, text })),
  }

  return {
    status: warnings && warnings.length > 0 ? 'partial' : 'parsed',
    structuredContent,
    warnings,
  }
}
