import { useState, useCallback, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useTrackActivity } from '@/hooks/useTrackActivity'
import { supabase } from '@/lib/supabase'
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
  companyProfileId,
  roleId,
}: {
  companies: string[]
  jobDescription?: string
  companyProfileId?: string | null
  roleId?: string | null
}) {
  const { session, user } = useAuth()
  const { trackEvent } = useTrackActivity('research')
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [isStreaming, setIsStreaming] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const loadedRoleRef = useRef<string | null>(null)

  // Load existing research session for this role
  useEffect(() => {
    if (!user || !roleId || loadedRoleRef.current === roleId) return
    loadedRoleRef.current = roleId

    supabase
      .from('research_sessions')
      .select('id, messages')
      .eq('user_id', user.id)
      .eq('company_role_id', roleId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .then(({ data, error }) => {
        if (error || !data || data.length === 0) return
        const row = data[0]
        const saved = row.messages as Array<{ role: string; content: string; timestamp: string }>
        if (!saved || saved.length === 0) return

        sessionIdRef.current = row.id as string
        setSessionId(row.id as string)
        setMessages(
          saved.map((m, i) => ({
            id: `saved-${i}`,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            timestamp: new Date(m.timestamp),
          }))
        )
      })
  }, [user, roleId])

  // Persist messages to research_sessions after streaming completes
  const persistMessages = useCallback(
    async (allMessages: Message[]) => {
      if (!user) return
      // Only persist if we have a role context
      if (!roleId) return

      const rows = allMessages
        .filter((m) => m.id !== 'init')
        .map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp.toISOString(),
        }))

      if (rows.length === 0) return

      if (sessionIdRef.current) {
        // Update existing session
        await supabase
          .from('research_sessions')
          .update({ messages: rows })
          .eq('id', sessionIdRef.current)
      } else {
        // Create new session
        const { data, error } = await supabase
          .from('research_sessions')
          .insert({
            user_id: user.id,
            company_profile_id: companyProfileId || null,
            company_role_id: roleId,
            title: rows[0]?.content?.slice(0, 80) || 'Research session',
            messages: rows,
          })
          .select('id')
          .single()

        if (!error && data) {
          sessionIdRef.current = data.id as string
          setSessionId(data.id as string)
        }
      }
    },
    [user, companyProfileId, roleId]
  )

  const resetMessages = useCallback(() => {
    setMessages([{ ...INITIAL_MESSAGE, timestamp: new Date() }])
    sessionIdRef.current = null
    setSessionId(null)
    loadedRoleRef.current = null
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

      trackEvent('board_write', {
        contextCount: companies.length,
      })

      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }))
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
              message: content.trim(),
              jobDescription: jobDescription?.trim() || undefined,
              history,
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

        // Persist after streaming completes
        setMessages((prev) => {
          persistMessages(prev)
          return prev
        })
      } catch {
        setPlaceholderContent(
          "Couldn't reach the research service right now. Please check your connection and try again.",
        )
      } finally {
        setIsStreaming(false)
      }
    },
    [session?.access_token, companies, jobDescription, messages, persistMessages],
  )

  return { messages, isStreaming, sendMessage, resetMessages, sessionId }
}
