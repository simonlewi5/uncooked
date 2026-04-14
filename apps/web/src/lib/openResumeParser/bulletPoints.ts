import type { ParserLines, ParserTextItem } from './types'

export const BULLET_POINTS = ['⋅', '∙', '🞄', '•', '⦁', '⚫︎', '●', '⬤', '⚬', '○']

function getMostCommonBulletPoint(text: string): string {
  const bulletToCount: Record<string, number> = BULLET_POINTS.reduce((acc, bullet) => {
    acc[bullet] = 0
    return acc
  }, {} as Record<string, number>)

  let bulletWithMostCount = BULLET_POINTS[0]
  let bulletMaxCount = 0

  for (const char of text) {
    if (Object.prototype.hasOwnProperty.call(bulletToCount, char)) {
      bulletToCount[char] += 1
      if (bulletToCount[char] > bulletMaxCount) {
        bulletWithMostCount = char
        bulletMaxCount = bulletToCount[char]
      }
    }
  }

  return bulletWithMostCount
}

function getFirstBulletPointLineIdx(lines: ParserLines): number | undefined {
  for (let i = 0; i < lines.length; i++) {
    for (const item of lines[i]) {
      if (BULLET_POINTS.some((bullet) => item.text.includes(bullet))) {
        return i
      }
    }
  }
  return undefined
}

const isWord = (value: string) => /^[^0-9]+$/.test(value)
const hasAtLeast8Words = (item: ParserTextItem) => item.text.split(/\s/).filter(isWord).length >= 8

export function getDescriptionsLineIdx(lines: ParserLines): number | undefined {
  let idx = getFirstBulletPointLineIdx(lines)

  if (idx === undefined) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.length === 1 && hasAtLeast8Words(line[0])) {
        idx = i
        break
      }
    }
  }

  return idx
}

export function getBulletPointsFromLines(lines: ParserLines): string[] {
  const firstBulletPointLineIndex = getFirstBulletPointLineIdx(lines)
  if (firstBulletPointLineIndex === undefined) {
    return lines.map((line) => line.map((item) => item.text).join(' ')).filter(Boolean)
  }

  let lineText = ''
  for (const item of lines.flat()) {
    if (!lineText.endsWith(' ') && !item.text.startsWith(' ')) {
      lineText += ' '
    }
    lineText += item.text
  }

  const commonBullet = getMostCommonBulletPoint(lineText)
  const firstBulletIndex = lineText.indexOf(commonBullet)
  if (firstBulletIndex !== -1) {
    lineText = lineText.slice(firstBulletIndex)
  }

  return lineText
    .split(commonBullet)
    .map((value) => value.trim())
    .filter(Boolean)
}
