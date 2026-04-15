import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { CompanyProfile } from '@/types'

interface CompanyProfileRow {
  id: string
  company_name: string
  company_website: string | null
  industry: string | null
  company_size: string | null
}

function isCompanyProfileRow(row: unknown): row is CompanyProfileRow {
  return (
    typeof row === 'object' &&
    row !== null &&
    typeof (row as Record<string, unknown>).id === 'string' &&
    typeof (row as Record<string, unknown>).company_name === 'string'
  )
}

export function useCompanySearch(query: string): { results: CompanyProfile[]; isLoading: boolean } {
  const [results, setResults] = useState<CompanyProfile[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (query.trim().length < 1) {
      setResults([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    const timeout = setTimeout(async () => {
      const { data, error } = await supabase
        .from('company_profiles')
        .select('id, company_name, company_website, industry, company_size')
        .ilike('company_name', `%${query}%`)
        .limit(6)
      if (error) {
        console.error('useCompanySearch: failed to fetch companies', error)
        setIsLoading(false)
        return
      }
      setResults(
        (data ?? []).filter(isCompanyProfileRow).map((row) => ({
          id: row.id,
          companyName: row.company_name,
          companyWebsite: row.company_website,
          industry: row.industry,
          companySize: row.company_size,
        })),
      )
      setIsLoading(false)
    }, 300)
    return () => clearTimeout(timeout)
  }, [query])

  return { results, isLoading }
}
