/**
 * Normalize and split skill strings that may be concatenated with
 * common delimiters (pipes, commas, ampersands, etc.)
 */

const SKILL_DELIMITERS = [
  /\s*\|\s*/,      // pipes with spaces: Python | Java
  /\s*,\s*/,        // commas: Python, Java
  /\s*&\s*/,        // ampersands: REST & GraphQL
  /\s*and\s+/i,     // "and": Python and Java
]

/**
 * Clean up HTML entities and encoding issues
 */
function decodeHtmlEntities(text: string): string {
  const map: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
  }

  let result = text
  for (const [entity, char] of Object.entries(map)) {
    result = result.replace(new RegExp(entity, 'g'), char)
  }
  
  // Remove any remaining HTML entities
  result = result.replace(/&#\d+;/g, '')
  result = result.replace(/&\w+;/g, '')
  
  return result
}

/**
 * Remove control characters and invalid UTF-8 sequences
 */
function removeControlCharacters(text: string): string {
  return text.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim()
}

/**
 * Normalize whitespace and clean text
 */
function normalizeWhitespace(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s•·°◦*\-–—]/g, '')  // Remove leading bullets/dashes
    .replace(/[•·°◦*\-–—]$/g, '')    // Remove trailing bullets/dashes
    .trim()
}

/**
 * Check if a string appears to be multiple concatenated skills
 */
function looksLikeConcatenatedSkills(text: string): boolean {
  // Has multiple potential delimiters
  const pipeCount = (text.match(/\|/g) || []).length
  const commaCount = (text.match(/,/g) || []).length
  const ampCount = (text.match(/&/g) || []).length
  
  return pipeCount >= 2 || commaCount >= 2 || (ampCount >= 2 && text.length > 30)
}

/**
 * Split a potentially concatenated skill string into individual skills
 */
export function splitConcatenatedSkills(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return []
  }

  // Clean encoding issues first
  let cleaned = decodeHtmlEntities(text)
  cleaned = removeControlCharacters(cleaned)
  cleaned = normalizeWhitespace(cleaned)

  // If it doesn't look concatenated, return as single skill
  if (!looksLikeConcatenatedSkills(cleaned) && !cleaned.includes('|') && !cleaned.includes(',')) {
    return cleaned ? [cleaned] : []
  }

  // Try each delimiter pattern
  for (const delimiter of SKILL_DELIMITERS) {
    if (delimiter.test(cleaned)) {
      return cleaned
        .split(delimiter)
        .map(skill => normalizeWhitespace(skill))
        .filter((skill): skill is string => {
          return Boolean(skill) && skill.length > 0 && skill.length < 100
        })
    }
  }

  // Fallback: return single skill if no delimiters found
  return cleaned ? [cleaned] : []
}

/**
 * Normalize an array of skill strings, splitting concatenated ones
 */
export function normalizeSkillsList(skills: string[]): string[] {
  const normalized = new Set<string>()

  for (const skill of skills) {
    const split = splitConcatenatedSkills(skill)
    for (const s of split) {
      if (s && s.length > 0 && s.length < 100) {
        // Capitalize first letter
        const capitalized = s.charAt(0).toUpperCase() + s.slice(1)
        normalized.add(capitalized)
      }
    }
  }

  return Array.from(normalized)
}

/**
 * Validate individual skill (simple check for reasonableness)
 */
export function isValidSkill(skill: string): boolean {
  if (!skill || typeof skill !== 'string') return false
  
  const trimmed = skill.trim()
  
  // Check length (skills are typically 2-50 characters)
  if (trimmed.length < 2 || trimmed.length > 80) return false
  
  // Check it's not just numbers or special characters
  if (!/[a-zA-Z]/.test(trimmed)) return false
  
  // Check it doesn't have excessive special characters
  const specialCharCount = (trimmed.match(/[^a-zA-Z0-9\s+#.&-]/g) || []).length
  if (specialCharCount > trimmed.length * 0.3) return false
  
  return true
}
