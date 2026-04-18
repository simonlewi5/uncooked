import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface ResearchCompanyProfile {
  id: string
  name: string
  category: string
  isFavorite: boolean
  company_website?: string
}

interface CompanyRow {
  id: string
  company_name: string
  industry: string | null
  is_favorite: boolean
  company_website?: string
}

export function useResearchCompanies() {
  const { user } = useAuth()
  const [companies, setCompanies] = useState<ResearchCompanyProfile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initial fetch
  useEffect(() => {
    if (!user) return

    const fetchCompanies = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const { data, error: fetchError } = await supabase
          .from('company_profiles')
          .select('id, company_name, industry, is_favorite, company_website')
          .eq('user_id', user.id)
          .order('is_favorite', { ascending: false })
          .order('company_name', { ascending: true })

        if (fetchError) throw fetchError

        const transformed: ResearchCompanyProfile[] = (data || []).map((row: CompanyRow) => ({
          id: row.id,
          name: row.company_name,
          category: row.industry || 'General',
          isFavorite: row.is_favorite || false,
          company_website: row.company_website || undefined,
        }))

        setCompanies(transformed)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch companies'
        setError(message)
        console.error('useResearchCompanies: failed to fetch companies', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCompanies()
  }, [user])

  const addCompany = (newCompany: ResearchCompanyProfile) => {
    setCompanies((prev) => {
      const exists = prev.some((c) => c.id === newCompany.id)
      return exists ? prev : [newCompany, ...prev]
    })
  }

  const toggleFavorite = async (id: string) => {
    const company = companies.find((c) => c.id === id)
    if (!company) return

    const newFavoriteState = !company.isFavorite

    try {
      const { error } = await supabase
        .from('company_profiles')
        .update({ is_favorite: newFavoriteState })
        .eq('id', id)

      if (error) throw error

      setCompanies((prev) =>
        prev
          .map((c) => (c.id === id ? { ...c, isFavorite: newFavoriteState } : c))
          .sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite)),
      )
    } catch (err) {
      console.error('useResearchCompanies: failed to update favorite', err)
    }
  }
  const deleteCompany = async (id: string) => {
    try {
        const { error } = await supabase
        .from('company_profiles')
        .delete()
        .eq('id', id)

        if (error) throw error

        setCompanies((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete company'
        console.error('useResearchCompanies: failed to delete company', err)
        setError(message)
    }
  }
  return { companies, isLoading, error, addCompany, toggleFavorite, deleteCompany }
}