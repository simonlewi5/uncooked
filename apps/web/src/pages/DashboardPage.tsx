import { TrendingUp, Building2, Calendar, Star, ChevronRight, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, Spinner } from '@/components/ui'
import { useDashboardData } from '@/hooks/useDashboardData'
import { cn } from '@/utils/cn'
import type { ResearchSessionSummary, CompanySummary, PipelineCounts } from '@/types'
import styles from './DashboardPage.module.css'

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const
const EMPTY_WEEK_HOURS = [0, 0, 0, 0, 0, 0, 0] as const

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
  const today = new Date().getDay()
  const maxHours = Math.max(...EMPTY_WEEK_HOURS, 1)

  return (
    <div className={styles.card}>
      <div className={styles.cardInner}>
        <div className={styles.cardHeaderRow}>
          <div className={styles.cardMeta}>
            <TrendingUp size={16} className={styles.cardMetaIcon} />
            <span className={styles.cardTitle}>Practice Consistency</span>
          </div>
          <div className={cn(styles.weekPill)}>
            <span>This Week</span>
          </div>
        </div>
        <div className={styles.statValue}>0h</div>
        <p className={styles.statEmpty}>Start your first session to track consistency</p>
        <div className={styles.barChart}>
          {DAY_LABELS.map((label, i) => {
            const heightPct = `${Math.max((EMPTY_WEEK_HOURS[i] / maxHours) * 100, 4)}%`
            return (
              <div key={i} className={styles.barGroup}>
                <div
                  className={cn(styles.bar, i === today && styles.barToday)}
                  style={{ height: heightPct }}
                />
                <span className={cn(styles.barLabel, i === today && styles.barLabelToday)}>
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
                <div className={styles.iconBox}>
                  {company.companyName.charAt(0).toUpperCase()}
                </div>
                <div className={styles.itemInfo}>
                  <p className={styles.itemTitle}>{company.companyName}</p>
                  {company.industry && <p className={styles.itemSub}>{company.industry}</p>}
                </div>
                <button className={styles.starBtn} aria-label={`Star ${company.companyName}`}>
                  <Star size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function AiPromoCard(): JSX.Element {
  return (
    <div className={styles.promoCard}>
      <Zap size={20} className={styles.promoIcon} />
      <p className={styles.promoTitle}>Unlock AI Mock Interviews</p>
      <p className={styles.promoSubtitle}>
        Practice with an AI interviewer tailored to your target role and company.
      </p>
      <Link to="/interview" className={styles.promoBtn}>
        Upgrade Now
      </Link>
    </div>
  )
}

function ApplicationPipelineCard({ pipeline }: ApplicationPipelineCardProps): JSX.Element {
  return (
    <div className={styles.card}>
      <div className={styles.cardInner}>
        <div className={styles.cardHeaderRow}>
          <span className={styles.cardTitle}>Application Pipeline</span>
          <div className={cn(styles.weekPill)}>
            <span>This Month</span>
          </div>
        </div>
        {pipeline.applied === 0 ? (
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
                <span className={styles.pipelineLabel}>Applied</span>
                <span className={styles.pipelineValue}>{pipeline.applied}</span>
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
                className={styles.progressLayer}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--color-bg-muted)',
                }}
              />
              <div
                className={styles.progressLayer}
                style={{
                  width: `${(pipeline.interviews / pipeline.applied) * 100}%`,
                  backgroundColor: 'var(--color-border-strong)',
                }}
              />
              <div
                className={styles.progressLayer}
                style={{
                  width: `${(pipeline.offers / pipeline.applied) * 100}%`,
                  backgroundColor: 'var(--color-text)',
                }}
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
          <PracticeConsistencyCard />
          <div className={styles.bottomRow}>
            <TargetCompaniesCard companies={data?.companies ?? []} />
            <AiPromoCard />
          </div>
        </div>
        <div className={styles.rightCol}>
          <RecentResearchCard sessions={data?.recentSessions ?? []} />
          <ApplicationPipelineCard
            pipeline={data?.pipeline ?? { applied: 0, interviews: 0, offers: 0 }}
          />
        </div>
      </div>
    </div>
  )
}
