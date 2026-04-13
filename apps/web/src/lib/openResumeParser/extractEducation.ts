import { dateFeatureSets, hasComma, hasLetter, hasNumber } from './commonFeatures'
import { getTextWithHighestFeatureScore } from './featureScoring'
import { getSectionLinesByKeywords } from './getSectionLines'
import { getBulletPointsFromLines, getDescriptionsLineIdx } from './bulletPoints'
import { divideSectionIntoSubsections } from './subsections'
import type { ParserFeatureSet, ParserTextItem, ResumeSectionToLines } from './types'

const hasSchool = (item: ParserTextItem) =>
  ['College', 'University', 'Institute', 'School', 'Academy', 'BASIS', 'Magnet'].some((school) =>
    item.text.includes(school)
  )
const hasDegree = (item: ParserTextItem) =>
  ['Associate', 'Bachelor', 'Master', 'PhD', 'Ph.'].some((degree) => item.text.includes(degree)) ||
  /[ABM][A-Z.]/.test(item.text)
const matchGPA = (item: ParserTextItem) => item.text.match(/[0-4]\.\d{1,2}/)
const matchGrade = (item: ParserTextItem) => {
  const grade = Number.parseFloat(item.text)
  if (Number.isFinite(grade) && grade <= 110) return [String(grade)] as unknown as RegExpMatchArray
  return null
}

const schoolFeatureSet: ParserFeatureSet[] = [
  [hasSchool, 4],
  [hasDegree, -4],
  [hasNumber, -4],
]

const degreeFeatureSet: ParserFeatureSet[] = [
  [hasDegree, 4],
  [hasSchool, -4],
  [hasNumber, -3],
]

const gpaFeatureSet: ParserFeatureSet[] = [
  [matchGPA, 4, true],
  [matchGrade, 3, true],
  [hasComma, -3],
  [hasLetter, -4],
]

export interface ParsedEducation {
  school: string
  degree: string
  date: string
  gpa: string
  descriptions: string[]
}

export function extractEducation(sections: ResumeSectionToLines): ParsedEducation[] {
  const lines = getSectionLinesByKeywords(sections, ['education'])
  const subsections = divideSectionIntoSubsections(lines)
  const educations: ParsedEducation[] = []

  for (const subsectionLines of subsections) {
    const textItems = subsectionLines.flat()
    const [school] = getTextWithHighestFeatureScore(textItems, schoolFeatureSet)
    const [degree] = getTextWithHighestFeatureScore(textItems, degreeFeatureSet)
    const [gpa] = getTextWithHighestFeatureScore(textItems, gpaFeatureSet)
    const [date] = getTextWithHighestFeatureScore(textItems, dateFeatureSets)

    let descriptions: string[] = []
    const descriptionsLineIdx = getDescriptionsLineIdx(subsectionLines)
    if (descriptionsLineIdx !== undefined) {
      descriptions = getBulletPointsFromLines(subsectionLines.slice(descriptionsLineIdx))
    }

    educations.push({ school, degree, gpa, date, descriptions })
  }

  if (educations.length > 0) {
    const coursesLines = getSectionLinesByKeywords(sections, ['course'])
    if (coursesLines.length > 0) {
      educations[0].descriptions.push(
        `Courses: ${coursesLines.flat().map((item) => item.text).join(' ')}`.trim()
      )
    }
  }

  return educations
}
