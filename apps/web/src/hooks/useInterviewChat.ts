import { useState, useCallback, useRef } from 'react'
import type { Message, JobDescriptionFormValue, InterviewStyle } from '@/types'

interface UseInterviewChatReturn {
  messages: Message[]
  isTyping: boolean
  sendMessage: (content: string) => Promise<void>
}

// Placeholder responses until the AI backend lands (#20/#21)
const STUB_RESPONSES = [
  "That's a great answer. Can you walk me through a specific example from your experience?",
  'Interesting. How did you measure the impact of that work?',
  "What were the biggest challenges you faced, and how did you overcome them?",
  'If you could do it differently, what would you change?',
  "How does that experience relate to what you'd be doing in this role?",
]

export function useInterviewChat(
  // jobData and style will be forwarded to the AI endpoint in #20/#21
  _jobData: JobDescriptionFormValue, // eslint-disable-line @typescript-eslint/no-unused-vars
  _style: InterviewStyle, // eslint-disable-line @typescript-eslint/no-unused-vars
): UseInterviewChatReturn {
  const responseIndexRef = useRef(0)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      role: 'assistant',
      content:
        "Hi! I'm your AI interviewer. I've reviewed the job description and I'm ready to begin. Tell me a bit about yourself and why you're interested in this role.",
      timestamp: new Date(),
    },
  ])
  const [isTyping, setIsTyping] = useState(false)

  const sendMessage = useCallback(async (content: string) => {
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMsg])
    setIsTyping(true)

    // Simulate network + thinking delay (replace with real API call in #21)
    await new Promise((resolve) => setTimeout(resolve, 1200 + Math.random() * 600))

    const assistantMsg: Message = {
      id: `a-${Date.now()}`,
      role: 'assistant',
      content: STUB_RESPONSES[responseIndexRef.current % STUB_RESPONSES.length],
      timestamp: new Date(),
    }

    responseIndexRef.current++
    setMessages((prev) => [...prev, assistantMsg])
    setIsTyping(false)
  }, [])

  return { messages, isTyping, sendMessage }
}
