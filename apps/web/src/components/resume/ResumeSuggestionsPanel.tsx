import type { KeyboardEvent } from 'react'
import { cn } from '@/utils/cn'
import type { ResumeTailorEdit } from '@/types'
import styles from './ResumeSuggestionsPanel.module.css'

export interface ResumeSuggestionItem {
  edit: ResumeTailorEdit
  currentValue: string | null
  isMapped: boolean
}

interface SuggestionDiffProps {
  edit: ResumeTailorEdit
  currentValue: string | null
  onAccept: () => void
  onDecline: () => void
  variant?: 'compact' | 'stacked'
}

const SuggestionDiff = ({ edit, currentValue, onAccept, onDecline, variant = 'compact' }: SuggestionDiffProps) => {
  if (variant === 'stacked') {
    return (
      <div style={{ borderLeft: '3px solid #4f46e5', paddingLeft: '0.75rem', marginTop: '0.25rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#666', marginBottom: '0.5rem' }}>
          AI Suggestion
        </div>
        <div
          style={{
            display: 'grid',
            gap: '0.75rem',
            marginBottom: '0.75rem',
            fontSize: '0.875rem',
          }}
        >
          <div style={{ padding: '0.75rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
            <strong style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem', color: '#999' }}>
              Current
            </strong>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {currentValue ?? '(not found)'}
            </p>
          </div>
          <div style={{ padding: '0.75rem', backgroundColor: '#f0f9ff', borderRadius: '4px' }}>
            <strong style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem', color: '#166534' }}>
              Proposed
            </strong>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{edit.replacement}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={(event) => {
              event.stopPropagation()
              onAccept()
            }}
            style={{
              padding: '0.375rem 0.75rem',
              fontSize: '0.75rem',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Accept
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation()
              onDecline()
            }}
            style={{
              padding: '0.375rem 0.75rem',
              fontSize: '0.75rem',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Decline
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ borderLeft: '3px solid #4f46e5', paddingLeft: '0.75rem', marginTop: '0.25rem', fontSize: '0.8125rem' }}>
      <div style={{ marginBottom: '0.25rem', color: '#666' }}>
        <span style={{ textDecoration: 'line-through', color: '#7f1d1d' }}>
          {currentValue ?? 'Current value unavailable (target may have been removed)'}
        </span>
        <span style={{ margin: '0 0.25rem' }}>→</span>
        <span style={{ color: '#166534' }}>{edit.replacement}</span>
      </div>
      <div style={{ display: 'flex', gap: '0.375rem' }}>
        <button
          onClick={(event) => {
            event.stopPropagation()
            onAccept()
          }}
          style={{
            padding: '0.25rem 0.5rem',
            fontSize: '0.7rem',
            backgroundColor: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
          }}
        >
          Accept
        </button>
        <button
          onClick={(event) => {
            event.stopPropagation()
            onDecline()
          }}
          style={{
            padding: '0.25rem 0.5rem',
            fontSize: '0.7rem',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
          }}
        >
          Decline
        </button>
      </div>
    </div>
  )
}

const getTargetLabel = (targetId: string) => {
  if (targetId === 'profile/name') return 'Name'
  if (targetId === 'profile/contact') return 'Contact'
  if (targetId === 'profile/summary') return 'Summary'
  if (targetId.startsWith('experience/') && targetId.includes('/bullets/')) return 'Experience bullet'
  if (targetId.startsWith('experience/')) return 'Experience'
  if (targetId.startsWith('education/')) return 'Education'
  if (targetId.startsWith('skills/')) return 'Skill'
  return 'Suggestion target'
}

const getSectionLabel = (edit: ResumeTailorEdit, isMapped: boolean) => {
  if (!isMapped) return 'Unmapped'
  if (edit.section === 'summary') return 'Summary'
  if (edit.section === 'experience') return 'Experience'
  if (edit.section === 'skills') return 'Skills'
  return 'Suggestion'
}

interface ResumeSuggestionsPanelProps {
  suggestions: ResumeSuggestionItem[]
  activeTargetId: string | null
  onActivateTarget: (targetId: string | null) => void
  onRevealTarget: (targetId: string) => void
  onAcceptTarget: (targetId: string) => void
  onDeclineTarget: (targetId: string) => void
}

export function ResumeSuggestionsPanel({
  suggestions,
  activeTargetId,
  onActivateTarget,
  onRevealTarget,
  onAcceptTarget,
  onDeclineTarget,
}: ResumeSuggestionsPanelProps): JSX.Element {
  const groupedSuggestions = suggestions.reduce<Record<string, ResumeSuggestionItem[]>>((groups, suggestion) => {
    const groupKey = suggestion.isMapped ? suggestion.edit.section : 'unmapped'
    groups[groupKey] = groups[groupKey] ?? []
    groups[groupKey].push(suggestion)
    return groups
  }, {})

  const sectionOrder = ['summary', 'experience', 'skills', 'unmapped']
  const visibleGroups = sectionOrder
    .map((groupKey) => ({
      groupKey,
      items: groupedSuggestions[groupKey] ?? [],
    }))
    .filter((group) => group.items.length > 0)

  const handleCardKeyDown = (event: KeyboardEvent<HTMLElement>, targetId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onRevealTarget(targetId)
    }
  }

  if (suggestions.length === 0) {
    return (
      <aside className={styles.panel} aria-label="AI suggestions">
        <div className={styles.panelHeader}>
          <div>
            <div className={styles.eyebrow}>AI Suggestions</div>
            <h3 className={styles.title}>Ready for tailored edits</h3>
            <p className={styles.subtitle}>Run Auto-Tailor to generate a review queue here.</p>
          </div>
          <span className={styles.count}>0</span>
        </div>
        <div className={styles.emptyState}>No suggestions yet. Generate a job-tailored resume pass to review edits here.</div>
      </aside>
    )
  }

  return (
    <aside className={styles.panel} aria-label="AI suggestions">
      <div className={styles.panelHeader}>
        <div>
          <div className={styles.eyebrow}>AI Suggestions</div>
          <h3 className={styles.title}>Review and apply edits</h3>
          <p className={styles.subtitle}>Each card maps to a resume field and can jump to the target section.</p>
        </div>
        <span className={styles.count}>{suggestions.length}</span>
      </div>

      <div className={styles.list}>
        {visibleGroups.map(({ groupKey, items }) => (
          <div key={groupKey} className={styles.group}>
            <div className={styles.groupLabel}>{groupKey === 'unmapped' ? 'Unmapped' : groupKey}</div>
            {items.map((item, index) => {
              const targetId = item.edit.targetId.trim()
              const isActive = activeTargetId === targetId
              const targetLabel = getTargetLabel(targetId)
              const sectionLabel = getSectionLabel(item.edit, item.isMapped)

              return (
                <article
                  key={targetId}
                  className={cn(styles.card, isActive && styles.cardActive)}
                  tabIndex={0}
                  onMouseEnter={() => onActivateTarget(targetId)}
                  onFocus={() => onActivateTarget(targetId)}
                  onClick={() => onRevealTarget(targetId)}
                  onKeyDown={(event) => handleCardKeyDown(event, targetId)}
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div className={styles.cardMeta}>
                    <div className={styles.targetLabel}>{sectionLabel}</div>
                    <span className={styles.targetBadge}>{targetLabel}</span>
                  </div>
                  <div className={styles.diff}>
                    <SuggestionDiff
                      edit={item.edit}
                      currentValue={item.currentValue}
                      onAccept={() => onAcceptTarget(targetId)}
                      onDecline={() => onDeclineTarget(targetId)}
                      variant={item.edit.section === 'experience' ? 'compact' : 'stacked'}
                    />
                  </div>
                </article>
              )
            })}
          </div>
        ))}
      </div>
    </aside>
  )
}
