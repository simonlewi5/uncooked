import type { ParserLine, ParserLines, ParserTextItems } from './types'

const BULLET_POINTS = ['⋅', '∙', '🞄', '•', '⦁', '⚫︎', '●', '⬤', '⚬', '○']

function shouldAddSpaceBetweenText(leftText: string, rightText: string): boolean {
  const leftEnd = leftText[leftText.length - 1]
  const rightStart = rightText[0]

  const needsSpaceAfterSeparator = [':', ',', '|', '.', ...BULLET_POINTS].includes(leftEnd)
  const needsSpaceBeforePipeOrBullet = ['|', ...BULLET_POINTS].includes(rightStart)

  if (needsSpaceAfterSeparator && rightStart !== ' ') return true
  if (leftEnd !== ' ' && needsSpaceBeforePipeOrBullet) return true
  return false
}

function getTypicalCharWidth(textItems: ParserTextItems): number {
  const filtered = textItems.filter((item) => item.text.trim() !== '')

  const heightToCount: Record<number, number> = {}
  const fontNameToCount: Record<string, number> = {}

  let commonHeight = 0
  let heightMaxCount = 0
  let commonFontName = ''
  let fontNameMaxCount = 0

  for (const item of filtered) {
    const { text, height, fontName } = item

    heightToCount[height] = (heightToCount[height] ?? 0) + 1
    if (heightToCount[height] > heightMaxCount) {
      commonHeight = height
      heightMaxCount = heightToCount[height]
    }

    fontNameToCount[fontName] = (fontNameToCount[fontName] ?? 0) + text.length
    if (fontNameToCount[fontName] > fontNameMaxCount) {
      commonFontName = fontName
      fontNameMaxCount = fontNameToCount[fontName]
    }
  }

  const commonTextItems = filtered.filter(
    (item) => item.fontName === commonFontName && item.height === commonHeight
  )

  const [totalWidth, numChars] = commonTextItems.reduce(
    (acc, cur) => [acc[0] + cur.width, acc[1] + cur.text.length],
    [0, 0]
  )

  return numChars > 0 ? totalWidth / numChars : 5
}

export function groupTextItemsIntoLines(textItems: ParserTextItems): ParserLines {
  const lines: ParserLines = []
  let line: ParserLine = []

  for (const item of textItems) {
    if (item.hasEOL) {
      if (item.text.trim() !== '') line.push({ ...item })
      lines.push(line)
      line = []
    } else if (item.text.trim() !== '') {
      line.push({ ...item })
    }
  }

  if (line.length > 0) lines.push(line)

  const typicalCharWidth = getTypicalCharWidth(lines.flat())

  for (const lineItems of lines) {
    for (let i = lineItems.length - 1; i > 0; i--) {
      const currentItem = lineItems[i]
      const leftItem = lineItems[i - 1]
      const leftEnd = leftItem.x + leftItem.width
      const distance = currentItem.x - leftEnd

      if (distance <= typicalCharWidth) {
        if (shouldAddSpaceBetweenText(leftItem.text, currentItem.text)) {
          leftItem.text += ' '
        }

        leftItem.text += currentItem.text
        const currentEnd = currentItem.x + currentItem.width
        leftItem.width = currentEnd - leftItem.x
        lineItems.splice(i, 1)
      }
    }
  }

  return lines
}
