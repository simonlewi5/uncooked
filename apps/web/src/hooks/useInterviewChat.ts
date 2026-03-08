import { useState, useCallback, useEffect, useRef } from 'react'
import type { Message, JobDescriptionFormValue, InterviewStyle } from '@/types'
import { supabase } from '@/lib/supabase'

interface UseInterviewChatReturn {
  messages: Message[]
  isTyping: boolean
  sendMessage: (content: string) => Promise<void>
}

export function useInterviewChat(
  jobData: JobDescriptionFormValue,
  style: InterviewStyle,
): UseInterviewChatReturn {
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

  const sendMessage = useCallback(async (content: string) => {
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

      const text =
        data?.error ??
        error?.message ??
        data?.message ??
        'Sorry, I could not generate a response. Please try again.'

      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: text,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMsg])
    } catch (e) {
      const errMsg =
        e instanceof Error ? e.message : 'Something went wrong. Please try again.'
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
  }, [jobData, style])

  return { messages, isTyping, sendMessage }
}
