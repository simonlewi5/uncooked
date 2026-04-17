import { readPdf } from '@/lib/openResumeParser/readPdf'
import type { ParserTextItem } from '@/lib/openResumeParser/types'

const MAX_CHARS = 28_000
const MAX_BYTES = 12 * 1024 * 1024

function truncate(text: string): string {
  if (text.length <= MAX_CHARS) return text
  return `${text.slice(0, MAX_CHARS)}\n\n[…truncated]`
}

function pdfToPlainText(items: ParserTextItem[]): string {
  return items
    .map((item) => item.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Reads supported research-chat attachments into a plain-text excerpt for the model.
 */
export async function readResearchChatAttachment(file: File): Promise<string> {
  if (file.size > MAX_BYTES) {
    throw new Error(`File is too large (max ${Math.round(MAX_BYTES / 1024 / 1024)} MB).`)
  }

  const name = file.name.toLowerCase()
  const mime = file.type.toLowerCase()
  const textMime =
    mime.startsWith('text/') || mime === 'application/json' || mime === 'application/csv'
  const textExt = /\.(txt|md|markdown|csv|tsv|json)$/i.test(file.name)

  if (textMime || textExt) {
    return truncate(await file.text())
  }

  if (mime === 'application/pdf' || name.endsWith('.pdf')) {
    const items = await readPdf(file)
    return truncate(pdfToPlainText(items))
  }

  throw new Error('Use a PDF or plain text file (.txt, .md, .csv, .json).')
}
