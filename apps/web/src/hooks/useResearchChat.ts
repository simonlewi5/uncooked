import { useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import type { Message } from '@/types'

const RATE_LIMIT_FRIENDLY_MESSAGE =
  'You are sending requests too quickly right now. Please wait a minute and try again.'

function normalizeResearchServiceMessage(message: string): string {
  const normalized = message.toLowerCase()
  if (
    normalized.includes('quota exceeded') ||
    normalized.includes('resource_exhausted') ||
    normalized.includes('rate limit') ||
    normalized.includes('exceeded your current quota')
  ) {
    return RATE_LIMIT_FRIENDLY_MESSAGE
  }
  return message
}

function mapResearchHttpError(status: number, details?: string): string {
  const normalizedDetails = details ? normalizeResearchServiceMessage(details) : ''

  if (status === 400) {
    return normalizedDetails || 'Something in this request was invalid. Please rephrase and try again.'
  }
  if (status === 401) {
    return 'Your session expired. Please sign in again to continue.'
  }
  if (status === 413) {
    return normalizedDetails || 'That request is too large. Please shorten your message.'
  }
  if (status === 429) {
    return normalizedDetails || RATE_LIMIT_FRIENDLY_MESSAGE
  }
  if (status === 502) {
    return normalizedDetails || 'The research service is temporarily unavailable. Please try again in a moment.'
  }
  if (status >= 500) {
    return normalizedDetails || 'We hit a server issue while generating your research response. Please try again shortly.'
  }

  return normalizedDetails || "I couldn't complete that request just now. Please try again."
}

const INITIAL_MESSAGE: Message = {
  id: 'init',
  role: 'assistant',
  content: 'Hi! I\'m your AI researcher. Drag a company into the context bar above, then ask anything.',
  timestamp: new Date(),
}

function msg(role: Message['role'], content: string, id = `${role}-${Date.now()}`): Message {
  return { id, role, content, timestamp: new Date() }
}

export function useResearchChat({
  companies,
  jobDescription,
}: {
  companies: string[]
  jobDescription?: string
}) {
  const { session } = useAuth()
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [isStreaming, setIsStreaming] = useState(false)

  const resetMessages = useCallback(() => {
    setMessages([{ ...INITIAL_MESSAGE, timestamp: new Date() }])
  }, [])

  const sendMessage = useCallback(
    async (
      displayContent: string,
      options?: {
        /** User question only (omit [Attached] line); defaults to displayContent. Sent as \`message\`; attachment body is sent separately. */
        prompt?: string
        attachment?: { fileName: string; text: string }
      },
    ) => {
      const pushError = (text: string) =>
        setMessages((prev) => [...prev, msg('assistant', text, `err-${Date.now()}`)])

      if (!companies.length) {
        pushError('Add at least one company to the context bar.')
        return
      }

      const prompt = (options?.prompt ?? displayContent).trim()
      const hasDoc = Boolean(options?.attachment?.text?.trim())
      if (!prompt && !hasDoc) {
        pushError('Enter a message or attach a file.')
        return
      }

      const userMsg = msg('user', displayContent.trim())
      const placeholder = msg('assistant', '')
      setMessages((prev) => [...prev, userMsg, placeholder])
      setIsStreaming(true)

      const history = messages.map((m) => ({ role: m.role, content: m.content }))
      const companyNames = companies.map((c) =>
        typeof c === 'string' ? c : (c as { name: string }).name,
      )

      const setPlaceholderContent = (text: string) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === placeholder.id ? { ...m, content: text } : m)),
        )
      const appendPlaceholder = (chunk: string) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === placeholder.id ? { ...m, content: m.content + chunk } : m)),
        )

      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/research-chat`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(session?.access_token
                ? { Authorization: `Bearer ${session.access_token}` }
                : {}),
            },
            body: JSON.stringify({
              companies: companyNames,
              message: prompt,
              jobDescription: jobDescription?.trim() || undefined,
              history,
              ...(options?.attachment?.text?.trim()
                ? {
                    attachment: {
                      fileName: options.attachment.fileName,
                      text: options.attachment.text.trim(),
                    },
                  }
                : {}),
            }),
          },
        )

        if (!res.ok) {
          const err =
            ((await res.json().catch(() => ({})) as { error?: string }).error ??
              res.statusText ??
              'Request failed')
          setPlaceholderContent(mapResearchHttpError(res.status, err))
          return
        }

        const reader = res.body?.getReader()
        if (!reader) {
          setPlaceholderContent('The research service returned an empty response. Please try again.')
          return
        }

        const decoder = new TextDecoder()
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const text = (JSON.parse(data) as { text?: string }).text
              if (text) appendPlaceholder(text)
            } catch {
              /* skip malformed */
            }
          }
        }
        reader.releaseLock()
      } catch {
        setPlaceholderContent(
          "Couldn't reach the research service right now. Please check your connection and try again.",
        )
      } finally {
        setIsStreaming(false)
      }
    },
    [session?.access_token, companies, jobDescription, messages],
  )

  return { messages, isStreaming, sendMessage, resetMessages }
}
