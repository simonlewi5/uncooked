import { dateFeatureSets, getHasText, hasNumber, isBold } from './commonFeatures'
import { getTextWithHighestFeatureScore } from './featureScoring'
import { getSectionLinesByKeywords } from './getSectionLines'
import { getBulletPointsFromLines, getDescriptionsLineIdx } from './bulletPoints'
import { divideSectionIntoSubsections } from './subsections'
import type { ParserFeatureSet, ParserTextItem, ResumeSectionToLines } from './types'

const keywords = ['work', 'experience', 'employment', 'history', 'job']

const jobTitles = [
  'Accountant', 'Administrator', 'Advisor', 'Agent', 'Analyst', 'Apprentice', 'Architect',
  'Assistant', 'Associate', 'Auditor', 'Bartender', 'Biologist', 'Bookkeeper', 'Buyer',
  'Carpenter', 'Cashier', 'CEO', 'Clerk', 'Co-op', 'Co-Founder', 'Consultant', 'Coordinator',
  'CTO', 'Developer', 'Designer', 'Director', 'Driver', 'Editor', 'Electrician', 'Engineer',
  'Extern', 'Founder', 'Freelancer', 'Head', 'Intern', 'Journalist', 'Lawyer', 'Lead', 'Manager',
  'Nurse', 'Officer', 'Operator', 'Photographer', 'President', 'Producer', 'Recruiter',
  'Representative', 'Researcher', 'Sales', 'Server', 'Scientist', 'Specialist', 'Supervisor',
  'Teacher', 'Technician', 'Trader', 'Trainee', 'Treasurer', 'Tutor', 'Vice', 'VP', 'Volunteer',
  'Webmaster', 'Worker',
]

const hasJobTitle = (item: ParserTextItem) =>
  jobTitles.some((jobTitle) => item.text.split(/\s/).some((word) => word === jobTitle))
const hasMoreThan5Words = (item: ParserTextItem) => item.text.split(/\s/).length > 5

const jobTitleFeatureSet: ParserFeatureSet[] = [
  [hasJobTitle, 4],
  [hasNumber, -4],
  [hasMoreThan5Words, -2],
]

export interface ParsedWorkExperience {
  company: string
  jobTitle: string
  date: string
  descriptions: string[]
}

export function extractWorkExperience(sections: ResumeSectionToLines): ParsedWorkExperience[] {
  const lines = getSectionLinesByKeywords(sections, keywords)
  const subsections = divideSectionIntoSubsections(lines)
  const entries: ParsedWorkExperience[] = []

  for (const subsectionLines of subsections) {
    const descriptionsLineIdx = getDescriptionsLineIdx(subsectionLines) ?? 2
    const infoTextItems = subsectionLines.slice(0, descriptionsLineIdx).flat()

    const [date] = getTextWithHighestFeatureScore(infoTextItems, dateFeatureSets)
    const [jobTitle] = getTextWithHighestFeatureScore(infoTextItems, jobTitleFeatureSet)

    const companyFeatureSet: ParserFeatureSet[] = [
      [isBold, 2],
      [getHasText(date), -4],
      [getHasText(jobTitle), -4],
    ]

    const [company] = getTextWithHighestFeatureScore(infoTextItems, companyFeatureSet, false)
    const descriptions = getBulletPointsFromLines(subsectionLines.slice(descriptionsLineIdx))

    entries.push({ company, jobTitle, date, descriptions })
  }

  return entries
}
