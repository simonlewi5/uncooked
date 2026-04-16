import { TrendingUp, Building2, Calendar, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, Spinner } from '@/components/ui'
import { GamificationCard } from '@/components/dashboard/GamificationCard'
import { useConsistencyMetrics } from '@/contexts/ConsistencyMetricsContext'
import { useDashboardData } from '@/hooks/useDashboardData'
import { cn } from '@/utils/cn'
import type { ResearchSessionSummary, CompanySummary, PipelineCounts } from '@/types'
import styles from './DashboardPage.module.css'

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

  const resume = data?.resume
  const interview = data?.interview
  const research = data?.research

  const totalSessions7d =
    (resume?.sessionsLast7d ?? 0) +
    (interview?.sessionsLast7d ?? 0) +
    (research?.sessionsLast7d ?? 0)

  const bestCurrentStreak = Math.max(
    resume?.currentStreakDays ?? 0,
    interview?.currentStreakDays ?? 0,
    research?.currentStreakDays ?? 0
  )

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
        <div className={styles.statValue}>{isLoading ? '...' : totalSessions7d}</div>
        <p className={styles.statEmpty}>
          {isLoading
            ? 'Loading consistency metrics...'
            : bestCurrentStreak > 0
              ? `Active streak: ${bestCurrentStreak} day${bestCurrentStreak === 1 ? '' : 's'}`
              : 'Start your first session to build a streak'}
        </p>
        <div className={styles.pipelineStats}>
          <div className={styles.pipelineStat}>
            <span className={styles.pipelineLabel}>Resume</span>
            <span className={styles.pipelineValue}>{resume?.sessionsLast7d ?? 0}</span>
          </div>
          <div className={styles.pipelineStat}>
            <span className={styles.pipelineLabel}>Interview</span>
            <span className={styles.pipelineValue}>{interview?.sessionsLast7d ?? 0}</span>
          </div>
          <div className={styles.pipelineStat}>
            <span className={styles.pipelineLabel}>Research</span>
            <span className={styles.pipelineValue}>{research?.sessionsLast7d ?? 0}</span>
          </div>
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
