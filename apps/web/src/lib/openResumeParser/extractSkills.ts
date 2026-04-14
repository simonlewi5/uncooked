import { getSectionLinesByKeywords } from './getSectionLines'
import { getBulletPointsFromLines, getDescriptionsLineIdx } from './bulletPoints'
import { normalizeSkillsList } from './normalizeSkills'
import type { ResumeSectionToLines } from './types'

export interface ParsedSkills {
  featuredSkills: string[]
  descriptions: string[]
}

export function extractSkills(sections: ResumeSectionToLines): ParsedSkills {
  const lines = getSectionLinesByKeywords(sections, ['skill'])
  const descriptionsLineIdx = getDescriptionsLineIdx(lines) ?? 0

  const rawDescriptions = getBulletPointsFromLines(lines.slice(descriptionsLineIdx))
  const rawFeaturedSkills = lines
    .slice(0, descriptionsLineIdx)
    .flat()
    .filter((item) => item.text.trim())
    .slice(0, 8)
    .map((item) => item.text.trim())

  // Normalize both lists to split concatenated skills (e.g., "Python | Java")
  const normalizedDescriptions = normalizeSkillsList(rawDescriptions)
  const normalizedFeaturedSkills = normalizeSkillsList(rawFeaturedSkills)

  return {
    featuredSkills: normalizedFeaturedSkills,
    descriptions: normalizedDescriptions,
  }
}
