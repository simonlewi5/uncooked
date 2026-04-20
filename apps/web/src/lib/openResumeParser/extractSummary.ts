import { getSectionLinesByKeywords } from './getSectionLines'
import type { ResumeSectionToLines } from './types'

// Matches "Summary", "Professional Summary", "About", "About Me", "Objective", etc.
const keywords = ['summary', 'objective', 'about']

export function extractSummary(sections: ResumeSectionToLines): string {
  const lines = getSectionLinesByKeywords(sections, keywords)
  return lines
    .flat()
    .map((item) => item.text)
    .join(' ')
    .trim()
}
