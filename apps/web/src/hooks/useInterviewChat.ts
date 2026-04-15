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

type ResumeNode = { text?: string }
interface StructuredResumeData {
  name?: ResumeNode
  contact?: ResumeNode
  summary?: ResumeNode
  experience?: Array<{ title?: ResumeNode; company?: ResumeNode; period?: ResumeNode; bullets?: Array<ResumeNode> }>
  skills?: Array<ResumeNode>
}

function formatResumeText(parsed: StructuredResumeData | null | undefined): string {
  if (!parsed || typeof parsed !== 'object' || !parsed.name) return ''
  let text = ''
  if (parsed.name?.text) text += `${parsed.name.text}\n`
  if (parsed.summary?.text) text += `SUMMARY\n${parsed.summary.text}\n\n`
  if (parsed.experience && Array.isArray(parsed.experience)) {
    text += `EXPERIENCE\n`
    parsed.experience.forEach((job) => {
      text += `${job.title?.text || ''} at ${job.company?.text || ''} (${job.period?.text || ''})\n`
      job.bullets?.forEach((b) => { text += `• ${b.text}\n` })
      text += '\n'
    })
  }
  if (parsed.skills && Array.isArray(parsed.skills)) {
    text += `SKILLS\n${parsed.skills.map((s) => s.text).join(', ')}\n`
  }
  return text.trim()
}


const createInitialInterviewMessage = (): Message => ({
  id: 'init',
  role: 'assistant',
  content:
    "Hi! I'm your AI interviewer. I've reviewed the job description and I'm ready to begin. Tell me a bit about yourself and why you're interested in this role.",
  timestamp: new Date(),
})

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

/** Find or create a company_profile for the given name; returns the profile id. */
async function ensureCompanyProfile(userId: string, companyName: string): Promise<string | null> {
  const trimmed = companyName.trim()
  if (!trimmed) return null

  // Check for existing profile (case-insensitive)
  const { data: matches } = await supabase
    .from('company_profiles')
    .select('id')
    .eq('user_id', userId)
    .ilike('company_name', trimmed)
    .limit(1)

  if (matches && matches.length > 0) return matches[0].id as string

  // Create a new profile with just the company name
  const { data: created, error } = await supabase
    .from('company_profiles')
    .insert({ user_id: userId, company_name: trimmed })
    .select('id')
    .single()

  if (error) {
    console.error('Failed to create company profile:', error)
    return null
  }

  return created.id as string
}

/** Persist a message array to the interview_sessions row. */
async function persistMessages(sessionId: string, messages: Message[]): Promise<void> {
  const rows = messages.map((m) => ({
    role: m.role,
    content: m.content,
    timestamp: m.timestamp.toISOString(),
  }))

  const { error } = await supabase
    .from('interview_sessions')
    .update({ messages: rows })
    .eq('id', sessionId)

  if (error) {
    console.error('Failed to persist interview messages:', error)
  }
}

interface UseInterviewChatReturn {
  messages: Message[]
  isTyping: boolean
  sendMessage: (content: string) => Promise<void>
  interviewSessionId: string | null
  /** Load a previously saved session so the user can continue the conversation. */
  resumeSession: (sessionId: string, pastMessages: Message[]) => void
  /** Reset to a fresh interview. */
  resetSession: () => void
}

export function useInterviewChat(
  jobData: JobDescriptionFormValue,
  style: InterviewStyle,
  activeResume?: any | null,
): UseInterviewChatReturn {
  const { user } = useAuth()
  // Tracks whether a practice_sessions row has been recorded for this session.
  // Ensures we only insert once per hook instance, not on every message.
  const sessionRecordedRef = useRef(false)
  // Tracks the interview_sessions row id once created.
  const interviewSessionIdRef = useRef<string | null>(null)
  const [interviewSessionId, setInterviewSessionId] = useState<string | null>(null)

  const [messages, setMessages] = useState<Message[]>([createInitialInterviewMessage()])
  const [isTyping, setIsTyping] = useState(false)
  const messagesRef = useRef<Message[]>([])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const resumeSession = useCallback((sessionId: string, pastMessages: Message[]) => {
    interviewSessionIdRef.current = sessionId
    setInterviewSessionId(sessionId)
    setMessages(pastMessages)
    // Mark as already recorded so we don't create a duplicate session row
    sessionRecordedRef.current = true
  }, [])

  const resetSession = useCallback(() => {
    interviewSessionIdRef.current = null
    setInterviewSessionId(null)
    setMessages([createInitialInterviewMessage()])
    sessionRecordedRef.current = false
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

      // On first user message of a new session: record practice session,
      // ensure company profile, and create the interview_sessions row.
      if (!sessionRecordedRef.current && user) {
        sessionRecordedRef.current = true

        // Record practice session for XP
        supabase
          .from('practice_sessions')
          .insert({ user_id: user.id, duration_minutes: 1 })
          .then(({ error }) => {
            if (error) {
              console.error('Failed to record practice session:', error)
              sessionRecordedRef.current = false
            }
          })

        // Ensure company profile exists and create interview session
        const companyProfileId = await ensureCompanyProfile(user.id, jobData.companyName)

        const { data: session, error: sessionError } = await supabase
          .from('interview_sessions')
          .insert({
            user_id: user.id,
            company_profile_id: companyProfileId,
            company_name: jobData.companyName.trim(),
            job_description: jobData.jobDescription,
            interview_style: style,
            messages: [],
          })
          .select('id')
          .single()

        if (sessionError) {
          console.error('Failed to create interview session:', sessionError)
        } else {
          interviewSessionIdRef.current = session.id as string
          setInterviewSessionId(session.id as string)
        }
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
            resumeContext: activeResume ? formatResumeText(activeResume.structured_content) : undefined,
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

        setMessages((prev) => {
          const updated = [...prev, assistantMsg]
          // Persist the full conversation to the database
          if (interviewSessionIdRef.current) {
            persistMessages(interviewSessionIdRef.current, updated)
          }
          return updated
        })
      } catch (e) {
        const errMsg = await mapInterviewErrorMessage(e)
        const assistantMsg: Message = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: errMsg,
          timestamp: new Date(),
        }
        setMessages((prev) => {
          const updated = [...prev, assistantMsg]
          if (interviewSessionIdRef.current) {
            persistMessages(interviewSessionIdRef.current, updated)
          }
          return updated
        })
      } finally {
        setIsTyping(false)
      }
    },
    [jobData, style, user, activeResume]
  )

  return { messages, isTyping, sendMessage, interviewSessionId, resumeSession, resetSession }
}
