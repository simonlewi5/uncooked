/** Plain display: strip markdown-style markers models often emit. */
export function stripResearchChatMarkdown(text: string): string {
  if (!text) return ''
  let s = text.replace(/\r\n/g, '\n')

  s = s.replace(/^#{1,6}\s+/gm, '')
  s = s.replace(/~~([^~]*)~~/g, '$1')
  s = s.replace(/```[\s\S]*?```/g, (b) => b.replace(/```/g, '').trim())
  s = s.replace(/`([^`]*?)`/g, '$1')
  s = s.replace(/__([^_]*)__/g, '$1')

  for (let i = 0; i < 10 && /\*\*/.test(s); i++) {
    s = s.replace(/\*\*([^*]*)\*\*/g, '$1')
  }
  s = s.replace(/\*\*/g, '')

  s = s.replace(/^\s*[\*\-•◦▪]\s+/gm, '')
  s = s.replace(/^\s*\d+\.\s+/gm, '')
  s = s.replace(/^>\s?/gm, '')
  s = s.replace(/(^|\s)_([^_\n]+)_($|\s)/g, '$1$2$3')

  s = s.replace(/\*/g, '')
  s = s.replace(/```/g, '')
  return s.replace(/\n{3,}/g, '\n\n').trimEnd()
}
