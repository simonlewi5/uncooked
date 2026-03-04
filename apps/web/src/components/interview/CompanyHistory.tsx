import { useState, useEffect } from 'react'
import { Building2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { CompanyProfile } from '@/types'
import { CompanyLogo } from './CompanyLogo'
import styles from './CompanyHistory.module.css'

interface CompanyHistoryProps {
  onSelect: (profile: CompanyProfile) => void
}

export function CompanyHistory({ onSelect }: CompanyHistoryProps): React.JSX.Element {
  const [companies, setCompanies] = useState<CompanyProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('company_profiles')
      .select('id, company_name, company_website, industry, company_size')
      .order('company_name', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error('CompanyHistory: failed to fetch companies', error)
          setIsLoading(false)
          return
        }
        setCompanies(
          (data ?? []).map((row) => ({
            id: row.id as string,
            companyName: row.company_name as string,
            companyWebsite: (row.company_website as string | null) ?? null,
            industry: (row.industry as string | null) ?? null,
            companySize: (row.company_size as string | null) ?? null,
          })),
        )
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

  if (companies.length === 0) {
    return (
      <div className={styles.empty}>
        <Building2 size={24} className={styles.emptyIcon} />
        <p className={styles.emptyText}>
          No companies saved yet. Companies appear here after researching them.
        </p>
      </div>
    )
  }

  return (
    <ul className={styles.list}>
      {companies.map((company) => (
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
        </li>
      ))}
    </ul>
  )
}
