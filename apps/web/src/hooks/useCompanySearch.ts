import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { CompanyProfile } from '@/types'

export function useCompanySearch(query: string): { results: CompanyProfile[]; isLoading: boolean } {
  const [results, setResults] = useState<CompanyProfile[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (query.trim().length < 1) {
      setResults([])
      return
    }
    const timeout = setTimeout(async () => {
      setIsLoading(true)
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
        (data ?? []).map((row) => ({
          id: row.id as string,
          companyName: row.company_name as string,
          companyWebsite: (row.company_website as string | null) ?? null,
          industry: (row.industry as string | null) ?? null,
          companySize: (row.company_size as string | null) ?? null,
        })),
      )
      setIsLoading(false)
    }, 300)
    return () => clearTimeout(timeout)
  }, [query])

  return { results, isLoading }
}
