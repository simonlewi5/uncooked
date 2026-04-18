import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { CompanyRole } from '@/types'

export function useCompanyRoles(companyProfileId: string | null) {
  const { user } = useAuth()
  const [roles, setRoles] = useState<CompanyRole[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchRoles = useCallback(async () => {
    if (!user || !companyProfileId) {
      setRoles([])
      return
    }

    setIsLoading(true)
    const { data, error } = await supabase
      .from('company_roles')
      .select('id, company_profile_id, role_title, job_description, is_active, created_at')
      .eq('user_id', user.id)
      .eq('company_profile_id', companyProfileId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch company roles:', error)
    } else {
      setRoles(
        (data ?? []).map((r) => ({
          id: r.id as string,
          companyProfileId: r.company_profile_id as string,
          roleTitle: r.role_title as string,
          jobDescription: r.job_description as string | null,
          isActive: r.is_active as boolean,
          createdAt: r.created_at as string,
        }))
      )
    }
    setIsLoading(false)
  }, [user, companyProfileId])

  useEffect(() => {
    fetchRoles()
  }, [fetchRoles])

  const addRole = useCallback(
    async (title: string, jobDescription?: string): Promise<CompanyRole | null> => {
      if (!user || !companyProfileId) return null

      const { data, error } = await supabase
        .from('company_roles')
        .insert({
          user_id: user.id,
          company_profile_id: companyProfileId,
          role_title: title.trim(),
          job_description: jobDescription?.trim() || null,
        })
        .select('id, company_profile_id, role_title, job_description, is_active, created_at')
        .single()

      if (error) {
        console.error('Failed to add company role:', error)
        return null
      }

      const newRole: CompanyRole = {
        id: data.id as string,
        companyProfileId: data.company_profile_id as string,
        roleTitle: data.role_title as string,
        jobDescription: data.job_description as string | null,
        isActive: data.is_active as boolean,
        createdAt: data.created_at as string,
      }
      setRoles((prev) => [newRole, ...prev])
      return newRole
    },
    [user, companyProfileId]
  )

  const updateRole = useCallback(
    async (id: string, updates: Partial<Pick<CompanyRole, 'roleTitle' | 'jobDescription'>>) => {
      const dbUpdates: Record<string, unknown> = {}
      if (updates.roleTitle !== undefined) dbUpdates.role_title = updates.roleTitle.trim()
      if (updates.jobDescription !== undefined)
        dbUpdates.job_description = updates.jobDescription?.trim() || null

      const { error } = await supabase.from('company_roles').update(dbUpdates).eq('id', id)

      if (error) {
        console.error('Failed to update company role:', error)
        return
      }

      setRoles((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                ...(updates.roleTitle !== undefined && { roleTitle: updates.roleTitle.trim() }),
                ...(updates.jobDescription !== undefined && {
                  jobDescription: updates.jobDescription?.trim() || null,
                }),
              }
            : r
        )
      )
    },
    []
  )

  const deleteRole = useCallback(async (id: string) => {
    const { error } = await supabase.from('company_roles').delete().eq('id', id)

    if (error) {
      console.error('Failed to delete company role:', error)
      return
    }

    setRoles((prev) => prev.filter((r) => r.id !== id))
  }, [])

  return {
    roles,
    isLoading,
    addRole,
    updateRole,
    deleteRole,
    refreshRoles: fetchRoles,
  }
}
