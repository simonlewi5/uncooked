import { useState, useCallback, useEffect, useRef } from 'react'
import type { Message, JobDescriptionFormValue, InterviewStyle } from '@/types'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

type ErrorWithContext = {
  message?: string
  context?: Response
}

type ErrorBody = {
  error?: string
  details?: string
}

const RATE_LIMIT_FRIENDLY_MESSAGE =
  'You are sending messages too quickly right now. Please wait a minute and try again.'

function normalizeInterviewServiceMessage(message: string): string {
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

async function mapInterviewErrorMessage(error: unknown): Promise<string> {
  const fallback = "I couldn't generate a response just now. Please try again."

  if (!error || typeof error !== 'object') return fallback

  const maybeError = error as ErrorWithContext
  const response = maybeError.context

  if (!response) {
    return maybeError.message ? normalizeInterviewServiceMessage(maybeError.message) : fallback
  }

  let details = ''
  try {
    const body = (await response.clone().json()) as ErrorBody
    details = body.details ?? body.error ?? ''
  } catch {
    details = ''
  }

  if (response.status === 429) {
    return details ? normalizeInterviewServiceMessage(details) : RATE_LIMIT_FRIENDLY_MESSAGE
  }

  if (response.status === 401) {
    return 'Your session expired. Please sign in again to continue your interview.'
  }

  if (response.status === 400) {
    return details
      ? normalizeInterviewServiceMessage(details)
      : 'Something in this request was invalid. Please shorten or rephrase your message and try again.'
  }

  if (response.status === 413) {
    return details
      ? normalizeInterviewServiceMessage(details)
      : 'That message is too long. Please send a shorter response.'
  }

  if (response.status === 405) {
    return details
      ? normalizeInterviewServiceMessage(details)
      : 'The interview service received an unsupported request. Please try sending your message again.'
  }

  if (response.status === 502) {
    return details
      ? normalizeInterviewServiceMessage(details)
      : 'The AI interview service is temporarily unavailable. Please try again in a moment.'
  }

  if (response.status >= 500) {
    return details
      ? normalizeInterviewServiceMessage(details)
      : 'We hit a server issue while generating your reply. Please try again shortly.'
  }

  if (details) return normalizeInterviewServiceMessage(details)
  if (maybeError.message) return normalizeInterviewServiceMessage(maybeError.message)
  return fallback
}

interface UseInterviewChatReturn {
  messages: Message[]
  isTyping: boolean
  sendMessage: (content: string) => Promise<void>
}

export function useInterviewChat(
  jobData: JobDescriptionFormValue,
  style: InterviewStyle
): UseInterviewChatReturn {
  const { user } = useAuth()
  // Tracks whether a practice_sessions row has been recorded for this session.
  // Ensures we only insert once per hook instance, not on every message.
  const sessionRecordedRef = useRef(false)

  const INITIAL_MESSAGE: Message = {
    id: 'init',
    role: 'assistant',
    content:
      "Hi! I'm your AI interviewer. I've reviewed the job description and I'm ready to begin. Tell me a bit about yourself and why you're interested in this role.",
    timestamp: new Date(),
  }

  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [isTyping, setIsTyping] = useState(false)
  const messagesRef = useRef<Message[]>([])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // Set up periodic flush of interview messages every 2 minutes
  useEffect(() => {
    const flushMessages = async () => {
      try {
        await supabase.functions.invoke('flush-interview-messages', {
          body: {},
        })
      } catch (error) {
        console.error('Error flushing interview messages:', error)
      }
    }

    const intervalId = setInterval(flushMessages, 2 * 60 * 1000)

    return () => clearInterval(intervalId)
  }, [])

  const sendMessage = useCallback(
    async (content: string) => {
      const userMsg: Message = {
        id: `u-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date(),
      }

      const previousMessages = messagesRef.current
      const conversationHistory = previousMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }))

      setMessages((prev) => [...prev, userMsg])
      setIsTyping(true)

      // Record the practice session on first user message so XP is awarded
      if (!sessionRecordedRef.current && user) {
        sessionRecordedRef.current = true
        supabase
          .from('practice_sessions')
          .insert({ user_id: user.id, duration_minutes: 1 })
          .then(({ error }) => {
            if (error) {
              console.error('Failed to record practice session:', error)
              sessionRecordedRef.current = false
            }
          })
      }

      try {
        const { data, error } = await supabase.functions.invoke<{
          message?: string
          error?: string
        }>('gemini-interview', {
          body: {
            jobDescription: jobData.jobDescription,
            companyName: jobData.companyName,
            companyContext: jobData.companyContext || undefined,
            interviewStyle: style,
            userMessage: content,
            conversationHistory,
          },
        })

        const fallback = "I couldn't generate a response just now. Please try again."
        const text = error
          ? await mapInterviewErrorMessage(error)
          : data?.error
            ? normalizeInterviewServiceMessage(data.error)
            : data?.message ?? fallback

        const assistantMsg: Message = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: text,
          timestamp: new Date(),
        }

        setMessages((prev) => [...prev, assistantMsg])
      } catch (e) {
        const errMsg = await mapInterviewErrorMessage(e)
        const assistantMsg: Message = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: errMsg,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, assistantMsg])
      } finally {
        setIsTyping(false)
      }
    },
    [jobData, style, user]
  )

  return { messages, isTyping, sendMessage }
}
