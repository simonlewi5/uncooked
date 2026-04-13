import {
  hasLetterAndIsAllUpperCase,
  hasOnlyLettersSpacesAmpersands,
  isBold,
} from './commonFeatures'
import type { ParserLine, ParserLines, ResumeSectionToLines } from './types'

export const PROFILE_SECTION = 'profile'

const sectionTitleKeywords = [
  'experience',
  'education',
  'project',
  'skill',
  'job',
  'course',
  'extracurricular',
  'objective',
  'summary',
  'award',
  'honor',
]

function isSectionTitle(line: ParserLine, lineNumber: number): boolean {
  const isFirstTwoLines = lineNumber < 2
  const hasMoreThanOneItemInLine = line.length > 1
  const hasNoItemInLine = line.length === 0

  if (isFirstTwoLines || hasMoreThanOneItemInLine || hasNoItemInLine) return false

  const textItem = line[0]

  if (isBold(textItem) && hasLetterAndIsAllUpperCase(textItem)) return true

  const text = textItem.text.trim()
  const textHasAtMost2Words = text.split(' ').filter((part) => part !== '&').length <= 2
  const startsWithCapitalLetter = /[A-Z]/.test(text.slice(0, 1))

  if (
    textHasAtMost2Words &&
    hasOnlyLettersSpacesAmpersands(textItem) &&
    startsWithCapitalLetter &&
    sectionTitleKeywords.some((keyword) => text.toLowerCase().includes(keyword))
  ) {
    return true
  }

  return false
}

export function groupLinesIntoSections(lines: ParserLines): ResumeSectionToLines {
  const sections: ResumeSectionToLines = {}
  let sectionName = PROFILE_SECTION
  let sectionLines: ParserLines = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const text = line[0]?.text.trim() ?? ''

    if (isSectionTitle(line, i)) {
      sections[sectionName] = [...sectionLines]
      sectionName = text
      sectionLines = []
    } else {
      sectionLines.push(line)
    }
  }

  if (sectionLines.length > 0) sections[sectionName] = [...sectionLines]
  return sections
}
