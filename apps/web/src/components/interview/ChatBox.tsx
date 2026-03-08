import React, { useRef, useEffect, useState, KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/utils/cn'
import type { Message } from '@/types'
import styles from './ChatBox.module.css'

interface ChatBoxProps {
  messages: Message[]
  isTyping: boolean
  onSend: (content: string) => void
  disabled?: boolean
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function ChatBox({ messages, isTyping, onSend, disabled }: ChatBoxProps): React.JSX.Element {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  useEffect(() => {
    if (input === '' && textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [input])

  const handleSend = () => {
    const content = input.trim()
    if (!content || disabled || isTyping) return
    onSend(content)
    setInput('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.messages}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              styles.message,
              msg.role === 'user' ? styles.messageUser : styles.messageAssistant,
            )}
          >
            <div
              className={cn(
                styles.bubble,
                msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
              )}
            >
              {msg.content}
            </div>
            <span className={styles.timestamp}>{formatTime(msg.timestamp)}</span>
          </div>
        ))}

        {isTyping && (
          <div className={styles.typing} aria-label="Assistant is typing">
            <span className={styles.typingDot} />
            <span className={styles.typingDot} />
            <span className={styles.typingDot} />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className={styles.inputRow}>
        <textarea
          ref={textareaRef}
          className={styles.inputField}
          placeholder="Type your answer here…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          rows={1}
          disabled={disabled || isTyping}
        />
        <Button
          size="sm"
          onClick={handleSend}
          disabled={!input.trim() || disabled || isTyping}
          aria-label="Send message"
        >
          <Send size={14} />
        </Button>
      </div>
    </div>
  )
}
