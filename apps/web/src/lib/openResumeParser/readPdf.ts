import * as pdfjs from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url'
import type { TextItem as PdfjsTextItem } from 'pdfjs-dist/types/src/display/api'
import type { ParserTextItems } from './types'

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker

export async function readPdf(file: File): Promise<ParserTextItems> {
  const fileUrl = URL.createObjectURL(file)

  try {
    const pdfFile = await pdfjs.getDocument(fileUrl).promise
    let textItems: ParserTextItems = []

    for (let i = 1; i <= pdfFile.numPages; i++) {
      const page = await pdfFile.getPage(i)
      const textContent = await page.getTextContent()
      await page.getOperatorList()
      const commonObjs = page.commonObjs

      const pageTextItems = textContent.items.map((item) => {
        const {
          str: text,
          transform,
          fontName: pdfFontName,
          ...otherProps
        } = item as PdfjsTextItem

        const x = transform[4]
        const y = transform[5]

        const fontObj = commonObjs.get(pdfFontName)
        const fontName = fontObj?.name ?? pdfFontName

        const normalizedText = text.replace(/-­‐/g, '-')

        return {
          ...otherProps,
          fontName,
          text: normalizedText,
          x,
          y,
        }
      })

      textItems.push(...pageTextItems)
    }

    textItems = textItems.filter((item) => !(!item.hasEOL && item.text.trim() === ''))

    return textItems
  } finally {
    URL.revokeObjectURL(fileUrl)
  }
}
