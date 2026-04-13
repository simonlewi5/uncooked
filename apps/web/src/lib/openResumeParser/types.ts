export interface ParserTextItem {
  text: string
  x: number
  y: number
  width: number
  height: number
  fontName: string
  hasEOL: boolean
}

export type ParserTextItems = ParserTextItem[]
export type ParserLine = ParserTextItem[]
export type ParserLines = ParserLine[]

export type ResumeSectionToLines = {
  [sectionName: string]: ParserLines
}

export type ParserFeatureScore = -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4

export type ParserFeatureSet =
  | [(item: ParserTextItem) => boolean, ParserFeatureScore]
  | [
      (item: ParserTextItem) => RegExpMatchArray | null,
      ParserFeatureScore,
      boolean,
    ]

export interface ParserTextScore {
  text: string
  score: number
  match: boolean
}

export type ParserSubsections = ParserLines[]
