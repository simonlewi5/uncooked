import type { ParserFeatureSet, ParserTextItem } from './types'

export const isBold = (item: ParserTextItem) => item.fontName.toLowerCase().includes('bold')
export const hasLetter = (item: ParserTextItem) => /[a-zA-Z]/.test(item.text)
export const hasNumber = (item: ParserTextItem) => /[0-9]/.test(item.text)
export const hasComma = (item: ParserTextItem) => item.text.includes(',')
export const getHasText = (text: string) => (item: ParserTextItem) => item.text.includes(text)
export const hasOnlyLettersSpacesAmpersands = (item: ParserTextItem) =>
  /^[A-Za-z\s&]+$/.test(item.text)
export const hasLetterAndIsAllUpperCase = (item: ParserTextItem) =>
  hasLetter(item) && item.text.toUpperCase() === item.text

const hasYear = (item: ParserTextItem) => /(?:19|20)\d{2}/.test(item.text)
const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const hasMonth = (item: ParserTextItem) =>
  months.some((month) => item.text.includes(month) || item.text.includes(month.slice(0, 4)))
const hasSeason = (item: ParserTextItem) =>
  ['Summer', 'Fall', 'Spring', 'Winter'].some((season) => item.text.includes(season))
const hasPresent = (item: ParserTextItem) => item.text.includes('Present')

export const dateFeatureSets: ParserFeatureSet[] = [
  [hasYear, 1],
  [hasMonth, 1],
  [hasSeason, 1],
  [hasPresent, 1],
  [hasComma, -1],
]
