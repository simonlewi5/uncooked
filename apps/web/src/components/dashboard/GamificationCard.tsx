import { Trophy } from 'lucide-react'
import { useGamificationData } from '@/hooks/useGamificationData'
import { cn } from '@/utils/cn'
import styles from './GamificationCard.module.css'

export function GamificationCard(): JSX.Element {
  const { data, isLoading } = useGamificationData()

  if (isLoading || !data) {
    return (
      <div className={styles.card}>
        <div className={styles.inner}>
          <div className={styles.skeleton} />
        </div>
      </div>
    )
  }

  const earnedCount = data.badges.filter((b) => b.earned).length

  return (
    <div className={styles.card}>
      <div className={styles.inner}>
        {/* ── Header ── */}
        <div className={styles.headerRow}>
          <div className={styles.headerMeta}>
            <Trophy size={16} className={styles.headerIcon} />
            <span className={styles.cardTitle}>Career Progress</span>
          </div>
          <div className={styles.levelPill}>
            <span>Level {data.level}</span>
          </div>
        </div>

        {/* ── Tier label + XP counters ── */}
        <div className={styles.tierRow}>
          <span className={styles.tierLabel}>{data.tierLabel}</span>
          <span className={styles.xpText}>
            {data.xpInLevel} / {data.xpForNextLevel} XP
          </span>
        </div>

        {/* ── Progress bar ── */}
        <div className={styles.progressTrack}>
          <div
            className={styles.progressFill}
            style={{ width: `${Math.max(data.progressPct, 2)}%` }}
          />
        </div>
        <p className={styles.xpHint}>
          {data.xpForNextLevel - data.xpInLevel} XP to Level {data.level + 1}
        </p>

        {/* ── Badges ── */}
        <div className={styles.badgesHeader}>
          <span className={styles.badgesLabel}>Achievements</span>
          <span className={styles.badgesCount}>
            {earnedCount}/{data.badges.length} earned
          </span>
        </div>
        <div className={styles.badgeRow}>
          {data.badges.map((badge) => (
            <div
              key={badge.id}
              className={cn(styles.badge, !badge.earned && styles.badgeLocked)}
              title={badge.earned ? badge.label : `🔒 ${badge.description}`}
            >
              <span className={styles.badgeIcon}>{badge.icon}</span>
              <span className={styles.badgeName}>{badge.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
