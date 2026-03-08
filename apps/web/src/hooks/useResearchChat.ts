import { useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export interface ResearchChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface UseResearchChatOptions {
  companies: string[]
  jobDescription?: string
  onStreamStart: () => void
  onStreamChunk: (text: string) => void
  onStreamEnd: () => void
  onError: (message: string) => void
}

export function useResearchChat({
  companies,
  jobDescription,
  onStreamStart,
  onStreamChunk,
  onStreamEnd,
  onError,
}: UseResearchChatOptions) {
  const { session } = useAuth()

  const sendMessage = useCallback(
    async (message: string, history: ResearchChatMessage[]) => {
      if (!session?.access_token) {
        onError('You must be signed in to use the research chat.')
        return
      }
      if (!companies.length) {
        onError('Add at least one company to the context bar.')
        return
      }

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/research-chat`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          companies: companies.map((c) => (typeof c === 'string' ? c : (c as { name: string }).name)),
          message: message.trim(),
          jobDescription: jobDescription?.trim() || undefined,
          history: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        onError((errBody as { error?: string }).error || res.statusText || 'Request failed')
        onStreamEnd()
        return
      }

      const reader = res.body?.getReader()
      if (!reader) {
        onError('No response stream')
        onStreamEnd()
        return
      }

      onStreamStart()
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
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') continue
              try {
                const obj = JSON.parse(data) as { text?: string }
                if (obj.text) onStreamChunk(obj.text)
              } catch {
                // skip malformed
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
        onStreamEnd()
      }
    },
    [
      session?.access_token,
      companies,
      jobDescription,
      onStreamStart,
      onStreamChunk,
      onStreamEnd,
      onError,
    ]
  )

  return { sendMessage }
}
