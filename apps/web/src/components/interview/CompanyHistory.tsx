import { useState, useEffect } from 'react'
import { Building2, MessageSquare } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { CompanyProfile, InterviewSessionSummary } from '@/types'
import { CompanyLogo } from './CompanyLogo'
import styles from './CompanyHistory.module.css'

interface CompanyHistoryProps {
  onSelect: (profile: CompanyProfile) => void
  onLoadSession?: (session: InterviewSessionSummary) => void
}

export function CompanyHistory({ onSelect, onLoadSession }: CompanyHistoryProps): React.JSX.Element {
  const [companies, setCompanies] = useState<CompanyProfile[]>([])
  const [sessions, setSessions] = useState<InterviewSessionSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase
        .from('company_profiles')
        .select('id, company_name, company_website, industry, company_size')
        .order('company_name', { ascending: true }),
      supabase
        .from('interview_sessions')
        .select('id, company_name, company_profile_id, interview_style, created_at')
        .order('created_at', { ascending: false }),
    ]).then(([companiesRes, sessionsRes]) => {
      if (companiesRes.error) {
        console.error('CompanyHistory: failed to fetch companies', companiesRes.error)
      } else {
        setCompanies(
          (companiesRes.data ?? []).map((row) => ({
            id: row.id as string,
            companyName: row.company_name as string,
            companyWebsite: (row.company_website as string | null) ?? null,
            industry: (row.industry as string | null) ?? null,
            companySize: (row.company_size as string | null) ?? null,
          })),
        )
      }

      if (sessionsRes.error) {
        console.error('CompanyHistory: failed to fetch sessions', sessionsRes.error)
      } else {
        setSessions(
          (sessionsRes.data ?? []).map((row) => ({
            id: row.id as string,
            companyName: row.company_name as string,
            companyProfileId: (row.company_profile_id as string | null) ?? null,
            interviewStyle: (row.interview_style as string | null) ?? null,
            createdAt: row.created_at as string,
          })),
        )
      }

      setIsLoading(false)
    })
  }, [])

  if (isLoading) {
    return (
      <div className={styles.empty} aria-busy="true" aria-label="Loading companies">
        <p className={styles.emptyText}>Loading…</p>
      </div>
    )
  }

  if (companies.length === 0 && sessions.length === 0) {
    return (
      <div className={styles.empty}>
        <Building2 size={24} className={styles.emptyIcon} />
        <p className={styles.emptyText}>
          No companies saved yet. Companies appear here after you start an interview.
        </p>
      </div>
    )
  }

  // Group sessions by company profile id (or by company name for unlinked sessions)
  const sessionsByCompany = new Map<string, InterviewSessionSummary[]>()
  for (const s of sessions) {
    const key = s.companyProfileId ?? `name:${s.companyName}`
    const list = sessionsByCompany.get(key) ?? []
    list.push(s)
    sessionsByCompany.set(key, list)
  }

  return (
    <ul className={styles.list}>
      {companies.map((company) => {
        const companySessions = sessionsByCompany.get(company.id) ?? []
        return (
          <li key={company.id}>
            <button className={styles.card} onClick={() => onSelect(company)}>
              <CompanyLogo company={company} size="md" />
              <div className={styles.cardText}>
                <span className={styles.cardName}>{company.companyName}</span>
                {(company.industry || company.companySize) && (
                  <span className={styles.cardMeta}>
                    {[company.industry, company.companySize].filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>
            </button>
            {companySessions.length > 0 && onLoadSession && (
              <ul className={styles.sessionList}>
                {companySessions.map((s) => (
                  <li key={s.id}>
                    <button
                      className={styles.sessionCard}
                      onClick={() => onLoadSession(s)}
                    >
                      <MessageSquare size={14} className={styles.sessionIcon} />
                      <span className={styles.sessionLabel}>
                        {s.interviewStyle ? `${s.interviewStyle} interview` : 'Interview'}
                      </span>
                      <span className={styles.sessionDate}>
                        {new Date(s.createdAt).toLocaleDateString()}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}
