const FILLER_PATTERNS = [
  /does that make sense/i,
  /ready to move on/i,
  /shall we (continue|move|proceed)/i,
  /could you elaborate/i,
  /can you clarify/i,
  /do you have any questions/i,
  /would you like to add anything/i,
  /is there anything else/i,
  /how does that sound/i,
  /do you understand/i,
  /okay\?$/i,
  /right\?$/i,
  /^and\b.{0,15}\?$/i,
]

const TECHNICAL_KEYWORDS =
  /\b(code|coding|algorithm|system design|architecture|database|api|debug|deploy|test|performance|scalab|data structure|runtime|complexity|implement|refactor|kubernetes|docker|aws|cloud|ci\/cd|git|sql|http|rest|graphql|microservice|concurren|thread|cache|load balanc|security|encrypt)\b/i

const BEHAVIORAL_KEYWORDS =
  /\b(tell me about a time|describe a (situation|time|scenario)|how (did|do|would) you handle|give me an example|what would you do if|walk me through|how have you dealt|past experience|conflict|challenge|teamwork|leadership|mistake|failure|difficult|pressure|deadline|feedback|disagree)\b/i

function isFiller(sentence: string): boolean {
  return FILLER_PATTERNS.some((p) => p.test(sentence))
}

function categorize(text: string): string {
  if (BEHAVIORAL_KEYWORDS.test(text)) return 'behavioral'
  if (TECHNICAL_KEYWORDS.test(text)) return 'technical'
  return 'general'
}

export interface ExtractedQuestion {
  text: string
  category: string
}

/**
 * Extracts interview questions from an assistant chat message.
 * Uses regex heuristics — no AI call needed.
 */
export function extractQuestions(content: string): ExtractedQuestion[] {
  // Split on sentence boundaries that end with a question mark.
  // Handles multi-line messages and numbered lists.
  const sentences = content
    .split(/(?<=[?])\s+/)
    .map((s) => s.replace(/^\d+[.)]\s*/, '').trim())
    .filter((s) => s.endsWith('?') && s.length > 15)

  const results: ExtractedQuestion[] = []
  const seen = new Set<string>()

  for (const sentence of sentences) {
    if (isFiller(sentence)) continue

    const normalized = sentence.toLowerCase()
    if (seen.has(normalized)) continue
    seen.add(normalized)

    results.push({ text: sentence, category: categorize(sentence) })
  }

  return results
}
