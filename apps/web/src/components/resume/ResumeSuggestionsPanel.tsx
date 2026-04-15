import type { KeyboardEvent, ReactNode } from 'react'
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

// Internal helper: Action buttons for accept/decline
interface SuggestionActionsProps {
  variant: 'compact' | 'stacked'
  onAccept: () => void
  onDecline: () => void
}

const SuggestionActions = ({ variant, onAccept, onDecline }: SuggestionActionsProps) => {
  const buttonClass = variant === 'stacked' ? styles.diffActionButtonStacked : styles.diffActionButtonCompact
  return (
    <div className={variant === 'stacked' ? styles.diffActionButtonsStacked : styles.diffActionButtonsCompact}>
      <button
        className={cn(buttonClass, styles.diffActionButtonAccept)}
        onClick={(event) => {
          event.stopPropagation()
          onAccept()
        }}
      >
        Accept
      </button>
      <button
        className={cn(buttonClass, styles.diffActionButtonDecline)}
        onClick={(event) => {
          event.stopPropagation()
          onDecline()
        }}
      >
        Decline
      </button>
    </div>
  )
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
      <div className={styles.diffStacked}>
        <div className={styles.diffStackedLabel}>AI Suggestion</div>
        <div className={styles.diffStackedGrid}>
          <div className={styles.diffStackedCurrent}>
            <strong className={styles.diffStackedCurrentLabel}>{currentLabel}</strong>
            <p className={styles.diffStackedText}>{currentDisplayText}</p>
          </div>
          <div className={styles.diffStackedProposed}>
            <strong className={styles.diffStackedProposedLabel}>Proposed</strong>
            <p className={styles.diffStackedText}>{replacementText}</p>
          </div>
        </div>
        <SuggestionActions variant="stacked" onAccept={onAccept} onDecline={onDecline} />
      </div>
    )
  }

  return (
    <div className={styles.diffCompact}>
      <div className={styles.diffCompactLine}>
        <span className={styles.diffCompactCurrent}>{currentDisplayText}</span>
        <span className={styles.diffCompactArrow}>→</span>
        <span className={styles.diffCompactProposed}>{replacementText}</span>
      </div>
      <SuggestionActions variant="compact" onAccept={onAccept} onDecline={onDecline} />
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

// Internal helper: Success and warning notices
interface NoticeCardProps {
  type: 'success' | 'warning'
  title: string
  body: string
  action?: {
    label: string
    onClick: () => void
  }
}

const NoticeCard = ({ type, title, body, action }: NoticeCardProps) => {
  const isSuccess = type === 'success'
  const Icon = isSuccess ? CheckCircle2 : AlertTriangle
  const styleClass = isSuccess ? styles.noticeSuccess : styles.noticeWarning

  return (
    <div className={cn(styles.noticeCard, styleClass)}>
      <div className={styles.noticeIcon} aria-hidden="true">
        <Icon size={18} />
      </div>
      <div className={styles.noticeContent}>
        <h4 className={styles.noticeTitle}>{title}</h4>
        <p className={styles.noticeBody}>{body}</p>
      </div>
      {action && (
        <button
          className={styles.noticeAction}
          onClick={(event) => {
            event.stopPropagation()
            action.onClick()
          }}
        >
          <RefreshCw size={14} />
          {action.label}
        </button>
      )}
    </div>
  )
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

  let friendlyNotice: ReactNode = null
  if (panelState === 'complete' && suggestions.length === 0) {
    friendlyNotice = (
      <NoticeCard
        type="success"
        title="No more edits needed"
        body="Your resume already looks aligned with this job description. You can export it or try another pass if the role changes."
      />
    )
  } else if (panelState === 'partial') {
    friendlyNotice = (
      <NoticeCard
        type="warning"
        title="We hit a response limit"
        body="The AI response may have been cut off before it could finish. Try Auto-Tailor again to see if we can get a fuller pass."
        action={onRetryTailor ? { label: 'Try Again', onClick: onRetryTailor } : undefined}
      />
    )
  }

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
        {friendlyNotice ?? (
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
        {friendlyNotice}
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
