import React, { useRef, useEffect, useState, KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { cn } from '@/utils/cn'
import type { InterviewQuestion, Message } from '@/types'
import styles from './ChatBox.module.css'

type CategoryAccent = 'behavioral' | 'technical' | 'system-design' | 'culture' | 'default'

function resolveCategoryAccent(category: string | null): CategoryAccent {
  if (!category) return 'default'
  const normalized = category.toLowerCase()
  if (normalized.includes('behav')) return 'behavioral'
  if (normalized.includes('system') || normalized.includes('design')) return 'system-design'
  if (normalized.includes('cultur') || normalized.includes('values')) return 'culture'
  if (normalized.includes('tech') || normalized.includes('coding') || normalized.includes('algo')) return 'technical'
  return 'default'
}

function humanizeCategory(category: string): string {
  return category
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

interface ChatBoxProps {
  messages: Message[]
  isTyping: boolean
  onSend: (content: string) => void
  disabled?: boolean
  activeQuestion?: InterviewQuestion | null
  activeQuestionIndex?: number
  totalQuestions?: number
}

function formatTime(raw: Date | string | number | null | undefined): string {
  if (raw === null || raw === undefined) return ''
  const date = raw instanceof Date ? raw : new Date(raw)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function ChatBox({
  messages,
  isTyping,
  onSend,
  disabled,
  activeQuestion,
  activeQuestionIndex,
  totalQuestions,
}: ChatBoxProps): React.JSX.Element {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messageCount = messages.length

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'auto' })
  }, [messageCount])

  const banner =
    activeQuestion &&
    totalQuestions !== undefined &&
    totalQuestions > 0 &&
    activeQuestionIndex !== undefined
      ? {
          question: activeQuestion,
          index: activeQuestionIndex,
          total: totalQuestions,
          accent: resolveCategoryAccent(activeQuestion.category),
        }
      : null

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
      {banner && (
        <div className={styles.banner}>
          <span className={styles.bannerCounter}>
            Q{banner.index + 1}
            <span className={styles.bannerCounterSlash}> / </span>
            {banner.total}
          </span>
          <span className={styles.bannerDivider} aria-hidden="true" />
          <span className={styles.bannerText}>{banner.question.questionText}</span>
          {banner.question.category && (
            <span className={styles.bannerBadge} data-accent={banner.accent}>
              {humanizeCategory(banner.question.category)}
            </span>
          )}
        </div>
      )}
      <div className={styles.messages}>
        {messages.map((msg) => {
          const time = formatTime(msg.timestamp)
          return (
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
                {msg.role === 'assistant' ? (
                  <div className={styles.markdown}>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
              {time && <span className={styles.timestamp}>{time}</span>}
            </div>
          )
        })}

        {isTyping && (
          <div className={styles.typing} aria-label="Assistant is typing">
            <span className={styles.typingDot} />
            <span className={styles.typingDot} />
            <span className={styles.typingDot} />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className={styles.inputArea}>
        <div className={styles.inputBox}>
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
          <button
            className={cn(styles.sendBtn, input.trim() && !disabled && !isTyping && styles.sendBtnActive)}
            onClick={handleSend}
            disabled={!input.trim() || disabled || isTyping}
            aria-label="Send message"
          >
            <Send size={15} />
          </button>
        </div>
        <p className={styles.hint}>Enter to send · Shift+Enter for new line</p>
        <p className={styles.exitHint}>Press Esc to exit</p>
      </div>
    </div>
  )
}
