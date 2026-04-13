import type { ParserFeatureSet, ParserTextItems, ParserTextScore } from './types'

function computeFeatureScores(textItems: ParserTextItems, featureSets: ParserFeatureSet[]): ParserTextScore[] {
  const textScores: ParserTextScore[] = textItems.map((item) => ({
    text: item.text,
    score: 0,
    match: false,
  }))

  for (let i = 0; i < textItems.length; i++) {
    const textItem = textItems[i]

    for (const featureSet of featureSets) {
      const [hasFeature, score, returnMatchingText] = featureSet
      const result = hasFeature(textItem)

      if (result) {
        let text = textItem.text
        if (returnMatchingText && typeof result === 'object') {
          text = result[0]
        }

        const textScore = textScores[i]
        if (textItem.text === text) {
          textScore.score += score
          if (returnMatchingText) textScore.match = true
        } else {
          textScores.push({ text, score, match: true })
        }
      }
    }
  }

  return textScores
}

export function getTextWithHighestFeatureScore(
  textItems: ParserTextItems,
  featureSets: ParserFeatureSet[],
  returnEmptyStringIfHighestScoreIsNotPositive = true,
  returnConcatenatedStringForTextsWithSameHighestScore = false
): [string, ParserTextScore[]] {
  const textScores = computeFeatureScores(textItems, featureSets)

  let textsWithHighestScore: string[] = []
  let highestScore = -Infinity

  for (const { text, score } of textScores) {
    if (score >= highestScore) {
      if (score > highestScore) textsWithHighestScore = []
      textsWithHighestScore.push(text)
      highestScore = score
    }
  }

  if (returnEmptyStringIfHighestScoreIsNotPositive && highestScore <= 0) {
    return ['', textScores]
  }

  const text = !returnConcatenatedStringForTextsWithSameHighestScore
    ? (textsWithHighestScore[0] ?? '')
    : textsWithHighestScore.map((value) => value.trim()).join(' ')

  return [text, textScores]
}
