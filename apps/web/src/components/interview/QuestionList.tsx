import { useState, useEffect, useCallback, useRef } from 'react'
import { Star, FileText, ChevronDown, ChevronRight, Sparkles, Loader2, Clock } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { InterviewQuestion } from '@/types'
import styles from './QuestionList.module.css'

type Filter = 'all' | 'bookmarked'

interface QuestionListProps {
  questions: InterviewQuestion[]
  isGenerating: boolean
  onGenerate: () => void
  onToggleBookmark: (id: string) => void
  onUpdateNotes: (id: string, notes: string) => void
  canGenerate: boolean
  cooldownEnd: number | null
  onCooldownStart: (end: number) => void
}

function QuestionCard({
  question,
  onToggleBookmark,
  onUpdateNotes,
}: {
  question: InterviewQuestion
  onToggleBookmark: () => void
  onUpdateNotes: (notes: string) => void
}): React.JSX.Element {
  const [showNotes, setShowNotes] = useState(
    () => !!question.answerNotes,
  )

  return (
    <li className={styles.card}>
      <div className={styles.cardHeader}>
        <button
          className={cn(styles.bookmarkBtn, question.isBookmarked && styles.bookmarked)}
          onClick={onToggleBookmark}
          aria-label={question.isBookmarked ? 'Remove bookmark' : 'Bookmark question'}
        >
          <Star size={14} fill={question.isBookmarked ? 'currentColor' : 'none'} />
        </button>
        <span className={styles.questionText}>{question.questionText}</span>
        {question.category && (
          <span className={styles.badge}>{question.category}</span>
        )}
      </div>

      <button
        className={styles.notesToggle}
        onClick={() => setShowNotes((v) => !v)}
      >
        {showNotes ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {showNotes ? 'Hide notes' : 'Add notes'}
      </button>

      {showNotes && (
        <textarea
          className={styles.notesArea}
          placeholder="Jot down key points, STAR method outline, etc."
          value={question.answerNotes ?? ''}
          onChange={(e) => onUpdateNotes(e.target.value)}
        />
      )}
    </li>
  )
}

const COOLDOWN_MS = 5 * 60 * 1000

function formatRemaining(ms: number): string {
  const totalSec = Math.ceil(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

export function QuestionList({
  questions,
  isGenerating,
  onGenerate,
  onToggleBookmark,
  onUpdateNotes,
  canGenerate,
  cooldownEnd,
  onCooldownStart,
}: QuestionListProps): React.JSX.Element {
  const [filter, setFilter] = useState<Filter>('all')
  const [remaining, setRemaining] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const onCooldown = cooldownEnd !== null && remaining > 0

  useEffect(() => {
    if (!cooldownEnd) return
    const tick = () => {
      const left = cooldownEnd - Date.now()
      if (left <= 0) {
        setRemaining(0)
        if (timerRef.current) clearInterval(timerRef.current)
      } else {
        setRemaining(left)
      }
    }
    tick()
    timerRef.current = setInterval(tick, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [cooldownEnd])

  const handleGenerate = useCallback(() => {
    onGenerate()
    onCooldownStart(Date.now() + COOLDOWN_MS)
  }, [onGenerate, onCooldownStart])

  const filtered =
    filter === 'bookmarked'
      ? questions.filter((q) => q.isBookmarked)
      : questions

  if (isGenerating) {
    return (
      <div className={styles.spinner}>
        <Loader2 size={16} className="animate-spin" style={{ marginRight: 8 }} />
        Generating questions...
      </div>
    )
  }

  if (questions.length === 0 && !canGenerate) {
    return (
      <div className={styles.empty}>
        <FileText size={24} className={styles.emptyIcon} />
        <p className={styles.emptyText}>
          Enter a job description to generate tailored interview questions.
        </p>
      </div>
    )
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        {canGenerate && (
          <button
            className={styles.generateBtn}
            onClick={handleGenerate}
            disabled={isGenerating || onCooldown}
          >
            {onCooldown ? (
              <>
                <Clock size={14} />
                {formatRemaining(remaining)}
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Generate Questions
              </>
            )}
          </button>
        )}
      </div>

      {questions.length > 0 && (
        <div className={styles.filterBar}>
          <button
            className={cn(styles.filterBtn, filter === 'all' && styles.filterBtnActive)}
            onClick={() => setFilter('all')}
          >
            All ({questions.length})
          </button>
          <button
            className={cn(styles.filterBtn, filter === 'bookmarked' && styles.filterBtnActive)}
            onClick={() => setFilter('bookmarked')}
          >
            Bookmarked ({questions.filter((q) => q.isBookmarked).length})
          </button>
        </div>
      )}

      {filtered.length === 0 && filter === 'bookmarked' ? (
        <div className={styles.empty}>
          <Star size={24} className={styles.emptyIcon} />
          <p className={styles.emptyText}>
            No bookmarked questions yet. Star questions you want to revisit.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <FileText size={24} className={styles.emptyIcon} />
          <p className={styles.emptyText}>
            Click "Generate Questions" to get tailored interview questions!
          </p>
        </div>
      ) : (
        <ul className={styles.list}>
          {filtered.map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              onToggleBookmark={() => onToggleBookmark(q.id)}
              onUpdateNotes={(notes) => onUpdateNotes(q.id, notes)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
