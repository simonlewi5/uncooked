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
  const [messages, setMessages] = useState<Message[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const messagesRef = useRef<Message[]>([])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // Kick off the first AI message as soon as the interview session starts
  useEffect(() => {
    if (hasStarted) return
    setHasStarted(true)

    ;(async () => {
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
            userMessage:
              "Please start the interview with an opening question based on the job description above. Don't repeat the full description back, just greet the candidate and ask your first question.",
            conversationHistory: [],
          },
        })

        const text =
          error?.message ||
          data?.message ||
          'Sorry, I could not generate a response. Please try again.'

        const assistantMsg: Message = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: text,
          timestamp: new Date(),
        }

        setMessages([assistantMsg])
      } catch (e) {
        const assistantMsg: Message = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content:
            "I'm having trouble starting the interview right now. Please try sending a message again in a moment.",
          timestamp: new Date(),
        }
        setMessages([assistantMsg])
      } finally {
        setIsTyping(false)
      }
    })()
  }, [hasStarted, jobData, style])

  const sendMessage = useCallback(async (content: string) => {
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    }
    
    // Capture the current messages
    const currentHistory = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    const previousMessages = messagesRef.current
    setMessages([...previousMessages, userMsg])
    setIsTyping(true)

    try {
      // Replace this URL with your actual Supabase Edge Function URL once deployed
      const response = await fetch('https://uncooked-web.vercel.app/interview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobDescription: jobData.jobDescription,
          companyName: jobData.companyName,
          companyContext: jobData.companyContext,
          interviewStyle: style,
          userMessage: content,
          conversationHistory: currentHistory, // Send the history!
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Failed to fetch response');

      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMsg])
    } catch (error) {
      console.error("Chat error:", error);
      // Optional: Add a UI error message here
    } finally {
      setIsTyping(false)
    }
  }, [messages, jobData, style])

  return { messages, isTyping, sendMessage }
}
