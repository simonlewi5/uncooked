import { useEffect } from 'react'
import { useGamificationData } from '@/hooks/useGamificationData'
import { XpBar } from './XpBar'
import styles from './CareerProgressCard.module.css'

export function CareerProgressCard(): JSX.Element | null {
  const { data, isLoading, refetch } = useGamificationData()

  useEffect(() => {
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') refetch()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [refetch])

  if (isLoading || !data) return null

  const earnedCount = data.badges.filter((b) => b.earned).length
  const xpToNext = Math.max(0, data.xpForNextLevel - data.xpInLevel)

  return (
    <section className={styles.card}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <div className={styles.titleBadge} aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M5 2h6v3a3 3 0 11-6 0V2zM3 3.5h2v1.5a4.5 4.5 0 004.5 4.5M13 3.5h-2v1.5a4.5 4.5 0 01-4.5 4.5M8 10v3M5 14h6"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className={styles.titleText}>
            <div className={styles.eyebrow}>Career progress</div>
            <div className={styles.tier}>{data.tierLabel}</div>
          </div>
        </div>
        <div className={styles.meta}>
          <span className={styles.levelChip}>LEVEL {data.level}</span>
          <span className={styles.xpText}>
            <span className={styles.xpStrong}>{data.xpInLevel}</span> / {data.xpForNextLevel} XP
          </span>
        </div>
      </header>

      <XpBar value={data.xpInLevel} max={data.xpForNextLevel} />

      <div className={styles.xpSub}>
        {xpToNext} XP to Level {data.level + 1}
      </div>

      <div className={styles.achievements}>
        <div className={styles.achievementsHeader}>
          <span className={styles.achievementsEyebrow}>Achievements</span>
          <span className={styles.achievementsCount}>
            <span className={styles.xpStrong}>{earnedCount}</span> / {data.badges.length} earned
          </span>
        </div>
        <div className={styles.achievementsGrid}>
          {data.badges.map((badge) => (
            <div
              key={badge.id}
              className={`${styles.achievement} ${badge.earned ? styles.achievementEarned : ''}`}
              title={badge.earned ? badge.label : badge.description}
            >
              <div className={styles.achievementIcon}>{badge.icon}</div>
              <div className={styles.achievementLabel}>{badge.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
