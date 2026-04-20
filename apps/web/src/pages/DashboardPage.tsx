import { useState } from 'react'
import { TrendingUp, Building2, Calendar, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, Spinner } from '@/components/ui'
import { CareerProgressCard } from '@/components/dashboard/CareerProgressCard'
import { ConsistencyBars } from '@/components/dashboard/ConsistencyBars'
import { useDashboardData } from '@/hooks/useDashboardData'
import { formatMinutes } from '@/utils/formatMinutes'
import { CompanyLogo } from '@/components/interview/CompanyLogo'
import { cn } from '@/utils/cn'
import type {
  ResearchSessionSummary,
  CompanySummary,
  PipelineCounts,
  DashboardRange,
  PracticeConsistencyData,
} from '@/types'
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
  const labels = data.labels
  const buckets = data.buckets
  const totalMinutes = data.totalMinutes
  const statLabel =
    totalMinutes === 0
      ? '0m'
      : totalMinutes < 60
        ? `${totalMinutes}m`
        : totalMinutes % 60 === 0
          ? `${totalMinutes / 60}h`
          : `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`

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

        <div className={styles.statValue}>{statLabel}</div>
        <p className={styles.statEmpty}>
          {data.totalMinutes === 0
            ? 'Start your first session to track consistency'
            : range === 'week'
              ? 'Practice time recorded this week'
              : 'Practice time recorded this month'}
        </p>

        <ConsistencyBars
          buckets={buckets}
          labels={labels}
          formatTooltip={(v) => (v === 0 ? 'No activity' : formatMinutes(v))}
        />
      </div>
    </div>
  )
}

function SessionLogo({ companyWebsite, companyName }: { companyWebsite: string | null; companyName: string | null }): JSX.Element {
  const [hasError, setHasError] = useState(false)
  if (companyWebsite && !hasError) {
    return (
      <img
        src={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/company-logo?domain=${encodeURIComponent(companyWebsite)}`}
        alt={companyName ?? ''}
        className={styles.sessionLogo}
        onError={() => setHasError(true)}
      />
    )
  }
  return (
    <div className={styles.iconBox}>
      <Building2 size={16} />
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
              <li key={session.id}>
                <Link
                  to="/research"
                  state={{ companyProfileId: session.companyProfileId, roleId: session.companyRoleId }}
                  className={styles.itemRow}
                >
                  <SessionLogo companyWebsite={session.companyWebsite} companyName={session.companyName} />
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
                </Link>
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
                <CompanyLogo company={company} size="sm" />
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

//function AiPromoCard(): JSX.Element {
  //return (
  //  <div className={styles.promoCard}>
    //  <Zap size={20} className={styles.promoIcon} />
     // <p className={styles.promoTitle}>Unlock AI Mock Interviews</p>
      //<p className={styles.promoSubtitle}>
        //Practice with an AI interviewer tailored to your target role and company.
     // <p>
    //  <Link to="/interview" className={styles.promoBtn}>
     //   Upgrade Now
     // </Link>
   // </div>
 // )
//}

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

        {pipeline.applied === 0 && pipeline.interviews === 0 && pipeline.offers === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>
              {range === 'week'
                ? 'No applications tracked this week'
                : 'No applications tracked this month'}
            </p>
            <Link to="/applications" className={styles.emptyAction}>
              Start tracking applications
            </Link>
          </div>
        ) : (
          <>
            <div className={styles.pipelineStats}>
              <div className={styles.pipelineStat}>
                <span className={styles.pipelineLabel}>Applied</span>
                <span className={cn(styles.pipelineValue, styles.pipelineValueApplied)}>{pipeline.applied}</span>
              </div>
              <div className={styles.pipelineStat}>
                <span className={styles.pipelineLabel}>Interviews</span>
                <span className={cn(styles.pipelineValue, styles.pipelineValueInterviews)}>{pipeline.interviews}</span>
              </div>
              <div className={styles.pipelineStat}>
                <span className={styles.pipelineLabel}>Offers</span>
                <span className={cn(styles.pipelineValue, styles.pipelineValueOffers)}>{pipeline.offers}</span>
              </div>
            </div>

            <div className={styles.progressTrack}>
              <div
                className={cn(styles.progressSegment, styles.progressSegmentApplied)}
                style={{ flex: pipeline.applied }}
              />
              <div
                className={cn(styles.progressSegment, styles.progressSegmentInterviews)}
                style={{ flex: pipeline.interviews }}
              />
              <div
                className={cn(styles.progressSegment, styles.progressSegmentOffers)}
                style={{ flex: pipeline.offers }}
              />
            </div>

            <div className={styles.pipelineFooter}>
              <Link to="/applications" className={styles.pipelineManageLink}>
                Manage in Applications <ChevronRight size={12} />
              </Link>
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

  // Demo-day mock — swap this in place of `data?.practiceConsistency ?? practiceFallback`
  // to show realistic week/month activity without needing real DB data.
  // const MOCK_PRACTICE: Record<DashboardRange, { totalMinutes: number; buckets: number[] }> = {
  //   week:  { totalMinutes: 285, buckets: [45, 0, 90, 30, 60, 0, 60] },  // M–Su
  //   month: { totalMinutes: 720, buckets: [180, 210, 150, 120, 60] },      // W1–W5
  // }

  const practiceFallback =
    practiceRange === 'week'
      ? { totalMinutes: 0, buckets: [0, 0, 0, 0, 0, 0, 0], labels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'] }
      : { totalMinutes: 0, buckets: [], labels: [] }

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
          <CareerProgressCard />
          <PracticeConsistencyCard
            range={practiceRange}
            onRangeChange={setPracticeRange}
            data={data?.practiceConsistency ?? practiceFallback}
            // data={MOCK_PRACTICE[practiceRange]}

          />
          <TargetCompaniesCard companies={data?.companies ?? []} />
        </div>

        <div className={styles.rightCol}>
          <RecentResearchCard sessions={data?.recentSessions ?? []} />
          <ApplicationPipelineCard
            range={pipelineRange}
            onRangeChange={setPipelineRange}
            pipeline={data?.pipeline ?? { applied: 0, interviews: 0, offers: 0 }}
          />
        </div>
      </div>
    </div>
  )
}
