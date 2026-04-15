import type { KeyboardEvent } from 'react'
import { CheckCircle2, RefreshCw, AlertTriangle } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { ResumeSuggestionViewModel } from '@/pages/resumeSuggestionTargets'
import styles from './ResumeSuggestionsPanel.module.css'

interface SuggestionDiffProps {
  currentText: string | null
  replacementText: string
  targetExists: boolean
  onAccept: () => void
  onDecline: () => void
  variant?: 'compact' | 'stacked'
}

const SuggestionDiff = ({
  currentText,
  replacementText,
  targetExists,
  onAccept,
  onDecline,
  variant = 'compact',
}: SuggestionDiffProps) => {
  const currentLabel = targetExists ? 'Current' : 'Target removed'
  const currentDisplayText = targetExists
    ? currentText ?? '(current text unavailable)'
    : 'This target no longer exists in the resume.'

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
              {currentLabel}
            </strong>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {currentDisplayText}
            </p>
          </div>
          <div style={{ padding: '0.75rem', backgroundColor: '#f0f9ff', borderRadius: '4px' }}>
            <strong style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem', color: '#166534' }}>
              Proposed
            </strong>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{replacementText}</p>
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
          {currentDisplayText}
        </span>
        <span style={{ margin: '0 0.25rem' }}>→</span>
        <span style={{ color: '#166534' }}>{replacementText}</span>
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

interface ResumeSuggestionsPanelProps {
  suggestions: ResumeSuggestionViewModel[]
  panelState?: 'idle' | 'complete' | 'partial'
  activeTargetId: string | null
  onActivateTarget: (targetId: string | null) => void
  onRevealTarget: (targetId: string) => void
  onAcceptTarget: (targetId: string) => void
  onDeclineTarget: (targetId: string) => void
  onRetryTailor?: () => void
}

export function ResumeSuggestionsPanel({
  suggestions,
  panelState = 'idle',
  activeTargetId,
  onActivateTarget,
  onRevealTarget,
  onAcceptTarget,
  onDeclineTarget,
  onRetryTailor,
}: ResumeSuggestionsPanelProps): JSX.Element {
  const groupedSuggestions = suggestions.reduce<Record<string, ResumeSuggestionViewModel[]>>((groups, suggestion) => {
    const groupKey = suggestion.targetExists ? suggestion.edit.section : 'unmapped'
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

  const renderFriendlyNotice = () => {
    if (panelState === 'complete' && suggestions.length === 0) {
      return (
        <div className={cn(styles.noticeCard, styles.noticeSuccess)}>
          <div className={styles.noticeIcon} aria-hidden="true">
            <CheckCircle2 size={18} />
          </div>
          <div className={styles.noticeContent}>
            <h4 className={styles.noticeTitle}>No more edits needed</h4>
            <p className={styles.noticeBody}>
              Your resume already looks aligned with this job description. You can export it or try another pass if the role changes.
            </p>
          </div>
        </div>
      )
    }

    if (panelState === 'partial') {
      return (
        <div className={cn(styles.noticeCard, styles.noticeWarning)}>
          <div className={styles.noticeIcon} aria-hidden="true">
            <AlertTriangle size={18} />
          </div>
          <div className={styles.noticeContent}>
            <h4 className={styles.noticeTitle}>We hit a response limit</h4>
            <p className={styles.noticeBody}>
              The AI response may have been cut off before it could finish. Try Auto-Tailor again to see if we can get a fuller pass.
            </p>
          </div>
          {onRetryTailor && (
            <button
              className={styles.noticeAction}
              onClick={(event) => {
                event.stopPropagation()
                onRetryTailor()
              }}
            >
              <RefreshCw size={14} />
              Try Again
            </button>
          )}
        </div>
      )
    }

    return null
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
        {renderFriendlyNotice() ?? (
          <div className={styles.emptyState}>No suggestions yet. Generate a job-tailored resume pass to review edits here.</div>
        )}
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
        {renderFriendlyNotice()}
        {visibleGroups.map(({ groupKey, items }) => (
          <div key={groupKey} className={styles.group}>
            <div className={styles.groupLabel}>{groupKey === 'unmapped' ? 'Unmapped' : groupKey}</div>
            {items.map((item, index) => {
              const targetId = item.targetId
              const isActive = activeTargetId === targetId

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
                    <div className={styles.targetLabel}>{item.sectionLabel}</div>
                    <span className={styles.targetBadge}>{item.targetLabel}</span>
                  </div>
                  <div className={styles.diff}>
                    <SuggestionDiff
                      currentText={item.currentText}
                      replacementText={item.replacementText}
                      targetExists={item.targetExists}
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
