/// <reference types="node" />

import { Buffer } from 'buffer'
import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { parsePdfFromBase64 } from './resumePdfParseService.js'

const port = Number(process.env.RESUME_PDF_PARSE_PORT ?? 4010)

const sendJson = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (req.method !== 'POST' || req.url !== '/parse-pdf') {
    sendJson(res, 404, { error: 'Not Found' })
    return
  }

  try {
    const chunks: Buffer[] = []
    for await (const chunk of req as AsyncIterable<Buffer | string>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }

    const rawBody = Buffer.concat(chunks).toString('utf-8')
    const payload = JSON.parse(rawBody) as {
      fileName?: unknown
      mimeType?: unknown
      bytesBase64?: unknown
    }

    if (
      typeof payload.fileName !== 'string' ||
      typeof payload.mimeType !== 'string' ||
      typeof payload.bytesBase64 !== 'string'
    ) {
      sendJson(res, 400, { error: 'Invalid payload shape' })
      return
    }

    const parsed = await parsePdfFromBase64({
      fileName: payload.fileName,
      mimeType: payload.mimeType,
      bytesBase64: payload.bytesBase64,
    })

    sendJson(res, 200, parsed)
  } catch (error) {
    sendJson(res, 500, {
      error: 'PDF parse failed',
      message: error instanceof Error ? error.message : String(error),
    })
  }
})

server.listen(port, () => {
  console.log(`resume-pdf-parse-service listening on http://localhost:${port}`)
})
