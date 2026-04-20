import { useState } from 'react'
import type { CompanyProfile } from '@/types'
import { cn } from '@/utils/cn'
import styles from './CompanyLogo.module.css'

interface CompanyLogoProps {
  company: Pick<CompanyProfile, 'companyName' | 'companyWebsite'>
  size: 'sm' | 'md'
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

function inferDomainFromName(name: string): string | null {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 32)
  return slug ? `${slug}.com` : null
}

export function CompanyLogo({ company, size }: CompanyLogoProps): React.JSX.Element {
  const [imgFailed, setImgFailed] = useState(false)
  const domain = getLogoDomain(company.companyWebsite) || inferDomainFromName(company.companyName)
  const initials = company.companyName.slice(0, 2).toUpperCase()

  if (domain && !imgFailed) {
    return (
      <img
        className={cn(styles.logo, styles[size])}
        src={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/company-logo?domain=${encodeURIComponent(domain)}`}
        alt={company.companyName}
        onError={() => setImgFailed(true)}
      />
    )
  }

  return <div className={cn(styles.logoFallback, styles[size])}>{initials}</div>
}