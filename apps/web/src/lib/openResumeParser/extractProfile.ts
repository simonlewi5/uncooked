import {
  hasComma,
  hasLetter,
  hasLetterAndIsAllUpperCase,
  hasNumber,
  isBold,
} from './commonFeatures'
import { getTextWithHighestFeatureScore } from './featureScoring'
import { getSectionLinesByKeywords } from './getSectionLines'
import type { ParserFeatureSet, ResumeSectionToLines } from './types'

const matchOnlyLetterSpaceOrPeriod = (text: string) => /^[a-zA-Z\s.]+$/.test(text)
const matchEmail = (text: string) => text.match(/\S+@\S+\.\S+/)
const matchPhone = (text: string) => text.match(/\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}/)
const matchCityAndState = (text: string) => text.match(/[A-Z][a-zA-Z\s]+, [A-Z]{2}/)
const matchUrl = (text: string) => text.match(/\S+\.[a-z]+\/\S+/)
const matchUrlHttp = (text: string) => text.match(/https?:\/\/\S+\.\S+/)
const matchUrlWww = (text: string) => text.match(/www\.\S+\.\S+/)

const hasAt = (text: string) => text.includes('@')
const hasParenthesis = (text: string) => /\([0-9]+\)/.test(text)
const hasSlash = (text: string) => text.includes('/')
const has4OrMoreWords = (text: string) => text.split(' ').length >= 4

const nameFeatureSets: ParserFeatureSet[] = [
  [(item) => (matchOnlyLetterSpaceOrPeriod(item.text) ? [item.text] as unknown as RegExpMatchArray : null), 3, true],
  [isBold, 2],
  [hasLetterAndIsAllUpperCase, 2],
  [(item) => (hasAt(item.text) ? [item.text] as unknown as RegExpMatchArray : null), -4, true],
  [hasNumber, -4],
  [(item) => (hasParenthesis(item.text) ? [item.text] as unknown as RegExpMatchArray : null), -4, true],
  [hasComma, -4],
  [(item) => (hasSlash(item.text) ? [item.text] as unknown as RegExpMatchArray : null), -4, true],
  [(item) => (has4OrMoreWords(item.text) ? [item.text] as unknown as RegExpMatchArray : null), -2, true],
]

const emailFeatureSets: ParserFeatureSet[] = [
  [(item) => matchEmail(item.text), 4, true],
  [isBold, -1],
  [hasLetterAndIsAllUpperCase, -1],
  [(item) => (hasParenthesis(item.text) ? [item.text] as unknown as RegExpMatchArray : null), -4, true],
  [hasComma, -4],
  [(item) => (hasSlash(item.text) ? [item.text] as unknown as RegExpMatchArray : null), -4, true],
  [(item) => (has4OrMoreWords(item.text) ? [item.text] as unknown as RegExpMatchArray : null), -4, true],
]

const phoneFeatureSets: ParserFeatureSet[] = [
  [(item) => matchPhone(item.text), 4, true],
  [hasLetter, -4],
]

const locationFeatureSets: ParserFeatureSet[] = [
  [(item) => matchCityAndState(item.text), 4, true],
  [isBold, -1],
  [(item) => (hasAt(item.text) ? [item.text] as unknown as RegExpMatchArray : null), -4, true],
  [(item) => (hasParenthesis(item.text) ? [item.text] as unknown as RegExpMatchArray : null), -3, true],
  [(item) => (hasSlash(item.text) ? [item.text] as unknown as RegExpMatchArray : null), -4, true],
]

const urlFeatureSets: ParserFeatureSet[] = [
  [(item) => matchUrl(item.text), 4, true],
  [(item) => matchUrlHttp(item.text), 3, true],
  [(item) => matchUrlWww(item.text), 3, true],
  [isBold, -1],
  [(item) => (hasAt(item.text) ? [item.text] as unknown as RegExpMatchArray : null), -4, true],
  [(item) => (hasParenthesis(item.text) ? [item.text] as unknown as RegExpMatchArray : null), -3, true],
  [hasComma, -4],
  [(item) => (has4OrMoreWords(item.text) ? [item.text] as unknown as RegExpMatchArray : null), -4, true],
]

const summaryFeatureSets: ParserFeatureSet[] = [
  [(item) => (has4OrMoreWords(item.text) ? [item.text] as unknown as RegExpMatchArray : null), 4, true],
  [isBold, -1],
  [(item) => (hasAt(item.text) ? [item.text] as unknown as RegExpMatchArray : null), -4, true],
  [(item) => (hasParenthesis(item.text) ? [item.text] as unknown as RegExpMatchArray : null), -3, true],
  [(item) => matchCityAndState(item.text), -4, false],
]

export function extractProfile(sections: ResumeSectionToLines) {
  const lines = sections.profile ?? []
  const textItems = lines.flat()

  const [name] = getTextWithHighestFeatureScore(textItems, nameFeatureSets)
  const [email] = getTextWithHighestFeatureScore(textItems, emailFeatureSets)
  const [phone] = getTextWithHighestFeatureScore(textItems, phoneFeatureSets)
  const [location] = getTextWithHighestFeatureScore(textItems, locationFeatureSets)
  const [url] = getTextWithHighestFeatureScore(textItems, urlFeatureSets)
  const [summaryFromProfile] = getTextWithHighestFeatureScore(textItems, summaryFeatureSets, undefined, true)

  const summaryLines = getSectionLinesByKeywords(sections, ['summary'])
  const summary = summaryLines.flat().map((item) => item.text).join(' ') || summaryFromProfile

  return {
    name,
    email,
    phone,
    location,
    url,
    summary,
  }
}
