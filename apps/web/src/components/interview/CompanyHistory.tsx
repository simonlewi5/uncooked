import { useState, useEffect } from 'react'
import { Building2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { CompanyProfile } from '@/types'
import styles from './CompanyHistory.module.css'

interface CompanyHistoryProps {
  onSelect: (profile: CompanyProfile) => void
}

interface LogoProps {
  company: CompanyProfile
}

function getLogoDomain(website: string | null): string | null {
  if (!website) return null
  try {
    return new URL(website.startsWith('http') ? website : `https://${website}`).hostname.replace(
      'www.',
      '',
    )
  } catch {
    return null
  }
}

function CompanyLogo({ company }: LogoProps): React.JSX.Element {
  const [imgFailed, setImgFailed] = useState(false)
  const domain = getLogoDomain(company.companyWebsite)
  const initials = company.companyName.slice(0, 2).toUpperCase()

  if (domain && !imgFailed) {
    return (
      <img
        className={styles.logo}
        src={`https://logo.clearbit.com/${domain}`}
        alt={company.companyName}
        onError={() => setImgFailed(true)}
      />
    )
  }

  return <div className={styles.logoFallback}>{initials}</div>
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
    return <div className={styles.empty} />
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
            <CompanyLogo company={company} />
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
