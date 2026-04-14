import { BULLET_POINTS } from './bulletPoints'
import { isBold } from './commonFeatures'
import type { ParserLine, ParserLines, ParserSubsections } from './types'

type IsLineNewSubsection = (line: ParserLine, prevLine: ParserLine) => boolean

function createIsLineNewSubsectionByLineGap(lines: ParserLines): IsLineNewSubsection {
  const lineGapToCount: Record<number, number> = {}
  const linesY = lines.map((line) => line[0].y)

  let lineGapWithMostCount = 0
  let maxCount = 0

  for (let i = 1; i < linesY.length; i++) {
    const lineGap = Math.round(linesY[i - 1] - linesY[i])
    lineGapToCount[lineGap] = (lineGapToCount[lineGap] ?? 0) + 1

    if (lineGapToCount[lineGap] > maxCount) {
      lineGapWithMostCount = lineGap
      maxCount = lineGapToCount[lineGap]
    }
  }

  const threshold = lineGapWithMostCount * 1.4
  return (line: ParserLine, prevLine: ParserLine) => Math.round(prevLine[0].y - line[0].y) > threshold
}

function createSubsections(lines: ParserLines, isLineNewSubsection: IsLineNewSubsection): ParserSubsections {
  const subsections: ParserSubsections = []
  let subsection: ParserLines = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (i === 0) {
      subsection.push(line)
      continue
    }

    if (isLineNewSubsection(line, lines[i - 1])) {
      subsections.push(subsection)
      subsection = []
    }

    subsection.push(line)
  }

  if (subsection.length > 0) subsections.push(subsection)
  return subsections
}

export function divideSectionIntoSubsections(lines: ParserLines): ParserSubsections {
  const byLineGap = createIsLineNewSubsectionByLineGap(lines)
  let subsections = createSubsections(lines, byLineGap)

  if (subsections.length === 1) {
    const byBold = (line: ParserLine, prevLine: ParserLine) =>
      !isBold(prevLine[0]) && isBold(line[0]) && !BULLET_POINTS.includes(line[0].text)

    subsections = createSubsections(lines, byBold)
  }

  return subsections
}
