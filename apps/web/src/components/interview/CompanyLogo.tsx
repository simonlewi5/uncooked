import { useState } from 'react'
import type { CompanyProfile } from '@/types'
import { cn } from '@/utils/cn'
import { resolveCompanyDomain } from '@/utils/companyDomain'
import styles from './CompanyLogo.module.css'

interface CompanyLogoProps {
  company: Pick<CompanyProfile, 'companyName' | 'companyWebsite'>
  size: 'sm' | 'md'
}

export function CompanyLogo({ company, size }: CompanyLogoProps): React.JSX.Element {
  const [imgFailed, setImgFailed] = useState(false)
  const domain = resolveCompanyDomain(company.companyName, company.companyWebsite)
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