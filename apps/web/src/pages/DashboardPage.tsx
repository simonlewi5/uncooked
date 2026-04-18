import { TrendingUp, Building2, Calendar, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, Spinner } from '@/components/ui'
import { GamificationCard } from '@/components/dashboard/GamificationCard'
import { useConsistencyMetrics } from '@/contexts/ConsistencyMetricsContext'
import { useDashboardData } from '@/hooks/useDashboardData'
import { formatMinutes } from '@/utils/formatMinutes'
import { cn } from '@/utils/cn'
import type { ResearchSessionSummary, CompanySummary, PipelineCounts } from '@/types'
import styles from './DashboardPage.module.css'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatTimeAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 1) return `${diffMins}m ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 1) return `${diffHours}h ago`
  return `${diffDays}d ago`
}


interface RecentResearchCardProps {
  sessions: ResearchSessionSummary[]
}

interface TargetCompaniesCardProps {
  companies: CompanySummary[]
}

interface ApplicationPipelineCardProps {
  pipeline: PipelineCounts
}

function PracticeConsistencyCard(): JSX.Element {
  const { data, isLoading } = useConsistencyMetrics()
  const todayDow = new Date().getDay() // 0 = Sun, 6 = Sat

  // Sum minutes across all three activity types for each date in the rolling window.
  const minutesByDate = new Map<string, number>()
  for (const activity of ['resume', 'interview', 'research'] as const) {
    for (const { date, minutes } of data?.[activity].dailyMinutes ?? []) {
      minutesByDate.set(date, (minutesByDate.get(date) ?? 0) + minutes)
    }
  }

  // Sun–Sat dates for the current calendar week.
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - todayDow + i)
    return d.toISOString().slice(0, 10)
  })

  // Future days in the week always show 0.
  
  const weekMinutes = weekDates.map((date, i) =>
    i <= todayDow ? (minutesByDate.get(date) ?? 0) : 0
  )

  // Demo-day mock: const weekMinutes = [12, 45, 90, 25, 120, 0, 65]

  const totalMinutes = weekMinutes.reduce((sum, m) => sum + m, 0)
  const maxMinutes = Math.max(...weekMinutes, 1)

  return (
    <div className={styles.card}>
      <div className={styles.cardInner}>
        <div className={styles.cardHeaderRow}>
          <div className={styles.cardMeta}>
            <TrendingUp size={16} className={styles.cardMetaIcon} />
            <span className={styles.cardTitle}>Practice Consistency</span>
          </div>
          <div className={styles.weekPill}>
            <span>This Week</span>
          </div>
        </div>
        <div className={styles.statValue}>
          {isLoading ? '...' : totalMinutes === 0 ? '0h' : formatMinutes(totalMinutes)}
        </div>
        <p className={styles.statEmpty}>
          {isLoading
            ? 'Loading consistency metrics...'
            : totalMinutes > 0
              ? 'Total practice time this week'
              : 'Start your first session to track consistency'}
        </p>
        <div className={styles.barChart}>
          {DAY_LABELS.map((label, i) => {
            const heightPx = Math.max((weekMinutes[i] / maxMinutes) * 80, 4)
            const tooltip = weekMinutes[i] === 0 ? 'No activity' : formatMinutes(weekMinutes[i])
            return (
              <div key={label} className={styles.barGroup} data-tooltip={tooltip}>
                <div
                  className={cn(styles.bar, i === todayDow && styles.barToday)}
                  style={{ height: heightPx }}
                />
                <span className={cn(styles.barLabel, i === todayDow && styles.barLabelToday)}>
                  {label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function RecentResearchCard({ sessions }: RecentResearchCardProps): JSX.Element {
  return (
    <div className={styles.card}>
      <div className={styles.cardInner}>
        <div className={styles.cardHeaderRow}>
          <span className={styles.cardTitle}>Recent Research</span>
          <Link to="/research" className={styles.seeAll}>
            See all <ChevronRight size={12} />
          </Link>
        </div>
        {sessions.length === 0 ? (
          <div className={styles.emptyState}>
            <Building2 size={24} className={styles.emptyIcon} />
            <p className={styles.emptyText}>No research sessions yet</p>
            <Link to="/research" className={styles.emptyAction}>
              Start researching a company
            </Link>
          </div>
        ) : (
          <ul className={styles.itemList}>
            {sessions.map((session) => (
              <li key={session.id} className={styles.itemRow}>
                <div className={styles.iconBox}>
                  <Building2 size={16} />
                </div>
                <div className={styles.itemInfo}>
                  <p className={styles.itemTitle}>{session.title ?? 'Research session'}</p>
                  <p className={styles.itemSub}>{session.companyName ?? '—'}</p>
                </div>
                <div className={styles.itemMeta}>
                  {session.industry && <Badge>{session.industry}</Badge>}
                  <span className={styles.timeStamp}>
                    <Calendar size={12} />
                    {formatTimeAgo(session.createdAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function TargetCompaniesCard({ companies }: TargetCompaniesCardProps): JSX.Element {
  return (
    <div className={styles.card}>
      <div className={styles.cardInner}>
        <div className={styles.cardHeaderRow}>
          <span className={styles.cardTitle}>Target Companies</span>
          <Link to="/research" className={styles.seeAll}>
            See all <ChevronRight size={12} />
          </Link>
        </div>
        {companies.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>No target companies saved</p>
            <Link to="/research" className={styles.emptyAction}>
              Research a company to add it
            </Link>
          </div>
        ) : (
          <ul className={styles.itemList}>
            {companies.map((company) => (
              <li key={company.id} className={styles.itemRow}>
                <div className={styles.iconBox}>{company.companyName.charAt(0).toUpperCase()}</div>
                <div className={styles.itemInfo}>
                  <p className={styles.itemTitle}>{company.companyName}</p>
                  {company.industry && <p className={styles.itemSub}>{company.industry}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}


function ApplicationPipelineCard({ pipeline }: ApplicationPipelineCardProps): JSX.Element {
  return (
    <div className={styles.card}>
      <div className={styles.cardInner}>
        <div className={styles.cardHeaderRow}>
          <span className={styles.cardTitle}>Application Pipeline</span>
          <div className={styles.weekPill}>
            <span>This Month</span>
          </div>
        </div>
        {pipeline.total === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>No applications tracked yet</p>
            <Link to="/research" className={styles.emptyAction}>
              Find companies to apply to
            </Link>
          </div>
        ) : (
          <>
            <div className={styles.pipelineStats}>
              <div className={styles.pipelineStat}>
                <span className={styles.pipelineLabel}>Total</span>
                <span className={styles.pipelineValue}>{pipeline.total}</span>
              </div>
              <div className={styles.pipelineStat}>
                <span className={styles.pipelineLabel}>Interviews</span>
                <span className={styles.pipelineValue}>{pipeline.interviews}</span>
              </div>
              <div className={styles.pipelineStat}>
                <span className={styles.pipelineLabel}>Offers</span>
                <span className={styles.pipelineValue}>{pipeline.offers}</span>
              </div>
            </div>
            <div className={styles.progressTrack}>
              <div
                className={cn(styles.progressLayer, styles.progressLayerMid)}
                style={{ width: `${(pipeline.interviews / pipeline.total) * 100}%` }}
              />
              <div
                className={cn(styles.progressLayer, styles.progressLayerTop)}
                style={{ width: `${(pipeline.offers / pipeline.total) * 100}%` }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function DashboardPage(): JSX.Element {
  const { data, isLoading, fetchError } = useDashboardData()

  if (isLoading) {
    return (
      <div className={styles.loadingState}>
        <Spinner size="lg" />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className={styles.errorState}>
        <p className={styles.errorText}>{fetchError}</p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.grid}>
        <div className={styles.leftCol}>
          <GamificationCard />
          <PracticeConsistencyCard />
          <div className={styles.bottomRow}>
            <TargetCompaniesCard companies={data?.companies ?? []} />

          </div>
        </div>
        <div className={styles.rightCol}>
          <RecentResearchCard sessions={data?.recentSessions ?? []} />
          <ApplicationPipelineCard
            pipeline={data?.pipeline ?? { total: 0, interviews: 0, offers: 0 }}
          />
        </div>
      </div>
    </div>
  )
}
