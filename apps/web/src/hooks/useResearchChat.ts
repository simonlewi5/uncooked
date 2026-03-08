import { useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import type { Message } from '@/types'

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
    async (content: string) => {
      const pushError = (text: string) =>
        setMessages((prev) => [...prev, msg('assistant', text, `err-${Date.now()}`)])

      if (!companies.length) {
        pushError('Add at least one company to the context bar.')
        return
      }

      const userMsg = msg('user', content.trim())
      const placeholder = msg('assistant', '')
      setMessages((prev) => [...prev, userMsg, placeholder])
      setIsStreaming(true)

      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }))
      const companyNames = companies.map((c) =>
        typeof c === 'string' ? c : (c as { name: string }).name,
      )

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/research-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            companies: companyNames,
            message: content.trim(),
            jobDescription: jobDescription?.trim() || undefined,
            history,
          }),
        },
      )

      const setPlaceholderContent = (text: string) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === placeholder.id ? { ...m, content: text } : m)),
        )
      const appendPlaceholder = (chunk: string) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === placeholder.id ? { ...m, content: m.content + chunk } : m)),
        )

      if (!res.ok) {
        const err = (await res.json().catch(() => ({})) as { error?: string }).error ?? res.statusText ?? 'Request failed'
        setPlaceholderContent(`Error: ${err}`)
        setIsStreaming(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) {
        setPlaceholderContent('Error: No response stream')
        setIsStreaming(false)
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''
      try {
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
      } finally {
        reader.releaseLock()
        setIsStreaming(false)
      }
    },
    [session?.access_token, companies, jobDescription, messages],
  )

  return { messages, isStreaming, sendMessage, resetMessages }
}
