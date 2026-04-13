/// <reference types="node" />

// @ts-expect-error Legacy pdfjs node build is resolved at runtime by tsx.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { Buffer } from 'buffer'

export type NodePdfParseRequest = {
  fileName: string
  mimeType: string
  bytesBase64: string
}

export type NodePdfParseResponse = {
  text: string
}

const decodeBase64ToUint8Array = (encoded: string): Uint8Array => {
  const binary = Buffer.from(encoded, 'base64')
  return new Uint8Array(binary)
}

export async function parsePdfFromBase64(request: NodePdfParseRequest): Promise<NodePdfParseResponse> {
  const bytes = decodeBase64ToUint8Array(request.bytesBase64)
  const loadingTask = pdfjs.getDocument({ data: bytes })
  const pdf = await loadingTask.promise

  const allLines: string[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()

    const pageText = content.items
      .map((item: unknown) => {
        const maybe = item as { str?: unknown }
        return typeof maybe.str === 'string' ? maybe.str : ''
      })
      .map((value: string) => value.trim())
      .filter(Boolean)
      .join(' ')

    if (pageText) {
      allLines.push(pageText)
    }
  }

  return {
    text: allLines.join('\n').trim(),
  }
}
