import type { ParserLines, ResumeSectionToLines } from './types'

export function getSectionLinesByKeywords(
  sections: ResumeSectionToLines,
  keywords: string[]
): ParserLines {
  for (const sectionName in sections) {
    const hasKeyword = keywords.some((keyword) => sectionName.toLowerCase().includes(keyword))
    if (hasKeyword) return sections[sectionName]
  }
  return []
}
