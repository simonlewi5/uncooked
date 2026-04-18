import { useState } from 'react'
import { TrendingUp, Building2, Calendar, ChevronRight, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, Spinner } from '@/components/ui'
import { GamificationCard } from '@/components/dashboard/GamificationCard'
import { useDashboardData } from '@/hooks/useDashboardData'
import { cn } from '@/utils/cn'
import type {
  ResearchSessionSummary,
  CompanySummary,
  PipelineCounts,
  DashboardRange,
  PracticeConsistencyData,
} from '@/types'
import styles from './DashboardPage.module.css'

const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const
const MONTH_BUCKET_LABELS = ['W1', 'W2', 'W3', 'W4', 'W5'] as const

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

interface RangePillsProps {
  value: DashboardRange
  onChange: (value: DashboardRange) => void
}

interface PracticeConsistencyCardProps {
  range: DashboardRange
  onRangeChange: (value: DashboardRange) => void
  data: PracticeConsistencyData
}

interface ApplicationPipelineCardProps {
  range: DashboardRange
  onRangeChange: (value: DashboardRange) => void
  pipeline: PipelineCounts
}

function RangePills({ value, onChange }: RangePillsProps): JSX.Element {
  return (
    <div className={styles.rangePills}>
      <button
        type="button"
        className={cn(styles.rangePillBtn, value === 'week' && styles.rangePillBtnActive)}
        onClick={() => onChange('week')}
      >
        This Week
      </button>
      <button
        type="button"
        className={cn(styles.rangePillBtn, value === 'month' && styles.rangePillBtnActive)}
        onClick={() => onChange('month')}
      >
        This Month
      </button>
    </div>
  )
}

function PracticeConsistencyCard({
  range,
  onRangeChange,
  data,
}: PracticeConsistencyCardProps): JSX.Element {
  const labels = range === 'week' ? WEEK_LABELS : MONTH_BUCKET_LABELS
  const buckets = data.buckets
  const maxMinutes = Math.max(...buckets, 1)
  const totalHours = (data.totalMinutes / 60).toFixed(data.totalMinutes % 60 === 0 ? 0 : 1)

  return (
    <div className={styles.card}>
      <div className={styles.cardInner}>
        <div className={styles.cardHeaderRow}>
          <div className={styles.cardMeta}>
            <TrendingUp size={16} className={styles.cardMetaIcon} />
            <span className={styles.cardTitle}>Practice Consistency</span>
          </div>
          <RangePills value={range} onChange={onRangeChange} />
        </div>

        <div className={styles.statValue}>{totalHours}h</div>
        <p className={styles.statEmpty}>
          {data.totalMinutes === 0
            ? 'Start your first session to track consistency'
            : range === 'week'
              ? 'Practice time recorded this ISO week'
              : 'Practice time recorded this month'}
        </p>

        <div className={styles.barChart}>
          {labels.map((label, i) => {
            const heightPct = `${Math.max((buckets[i] / maxMinutes) * 100, 4)}%`

            return (
              <div key={`bucket-${i}`} className={styles.barGroup}>
                <div className={styles.bar} style={{ height: heightPct }} />
                <span className={styles.barLabel}>{label}</span>
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

function ApplicationPipelineCard({
  range,
  onRangeChange,
  pipeline,
}: ApplicationPipelineCardProps): JSX.Element {
  return (
    <div className={styles.card}>
      <div className={styles.cardInner}>
        <div className={styles.cardHeaderRow}>
          <span className={styles.cardTitle}>Application Pipeline</span>
          <RangePills value={range} onChange={onRangeChange} />
        </div>

        {pipeline.total === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>
              {range === 'week'
                ? 'No applications tracked this week'
                : 'No applications tracked this month'}
            </p>
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
  const [practiceRange, setPracticeRange] = useState<DashboardRange>('week')
  const [pipelineRange, setPipelineRange] = useState<DashboardRange>('month')

  const { data, isLoading, fetchError } = useDashboardData({
    practiceRange,
    pipelineRange,
  })

  const practiceFallback =
    practiceRange === 'week'
      ? { totalMinutes: 0, buckets: [0, 0, 0, 0, 0, 0, 0] }
      : { totalMinutes: 0, buckets: [0, 0, 0, 0, 0] }

  const shouldShowInitialLoader = isLoading && !data
  const shouldShowFullPageError = fetchError && !data

  if (shouldShowInitialLoader) {
    return (
      <div className={styles.loadingState}>
        <Spinner size="lg" />
      </div>
    )
  }

  if (shouldShowFullPageError) {
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
          <PracticeConsistencyCard
            range={practiceRange}
            onRangeChange={setPracticeRange}
            data={data?.practiceConsistency ?? practiceFallback}
          />
          <div className={styles.bottomRow}>
            <TargetCompaniesCard companies={data?.companies ?? []} />
            <AiPromoCard />
          </div>
        </div>

        <div className={styles.rightCol}>
          <RecentResearchCard sessions={data?.recentSessions ?? []} />
          <ApplicationPipelineCard
            range={pipelineRange}
            onRangeChange={setPipelineRange}
            pipeline={data?.pipeline ?? { total: 0, interviews: 0, offers: 0 }}
          />
        </div>
      </div>
    </div>
  )
}