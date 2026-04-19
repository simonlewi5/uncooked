import { useState, useRef, useEffect } from 'react'
import { Plus, Search, Send, X, Paperclip, Star, Trash2, ChevronRight, ChevronDown, Play, Briefcase } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useResearchChat } from '@/hooks/useResearchChat'
import { useResearchCompanies } from '@/hooks/useResearchCompanies'
import { useCompanyRoles } from '@/hooks/useCompanyRoles'
import { StandardToast } from '@/components/interview/Toast'
import AddCompanyModal from './AddCompanyPage'
import { cn } from '@/utils/cn'
import { ConfirmModal } from '@/utils/ConfirmModal'
import type { CompanyRole } from '@/types'
import styles from './ResearchPage.module.css'

interface CompanyProfile {
  id: string
  name: string
  category: string
  isFavorite: boolean
  company_website?: string
}

interface ActiveContextItem {
  company: CompanyProfile
  role?: CompanyRole
}

const CATEGORY_STYLE: Record<string, string> = {
  Technology: styles.categoryTechnology,
  Fintech: styles.categoryFintech,
  DevTools: styles.categoryDevtools,
  'AI/ML': styles.categoryAiml,
  Healthcare: styles.categoryHealthcare,
  'E-commerce': styles.categoryEcommerce,
  SaaS: styles.categorySaas,
}

function CompanyLogo({ company, styles }: { company: CompanyProfile, styles: Record<string, string> }) {
  const [hasError, setHasError] = useState(false);
  if (!company.company_website || hasError) {
    return (
      <div className={styles.logoFallback}>
        {company.name.charAt(0).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/company-logo?domain=${encodeURIComponent(company.company_website)}`}
      alt={`${company.name} logo`}
      className={styles.logoImage}
      onError={() => setHasError(true)}
    />
  );
}

export default function ResearchPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchQuery, setSearchQuery] = useState(() => {
    return location.state?.companyName || '';
  });
  const [activeContext, setActiveContext] = useState<ActiveContextItem[]>([])
  const [input, setInput] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const draggingCompany = useRef<CompanyProfile | null>(null)
  const { user } = useAuth()
  const { companies: dbCompanies, isLoading, toggleFavorite, deleteCompany, refreshCompanies } = useResearchCompanies()
  const [toastConfig, setToastConfig] = useState<{ message: string; variant: 'success' | 'error' } | null>(null)
  const [companyToDelete, setCompanyToDelete] = useState<{ id: string, name: string } | null>(null)

  // Expandable roles state
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(
    (location.state as { companyProfileId?: string } | null)?.companyProfileId || null
  )
  const { roles, isLoading: rolesLoading, addRole, deleteRole } = useCompanyRoles(expandedCompanyId)

  // Add role inline form state
  const [isAddingRole, setIsAddingRole] = useState(false)
  const [newRoleTitle, setNewRoleTitle] = useState('')
  const [newRoleJd, setNewRoleJd] = useState('')
  const roleInputRef = useRef<HTMLInputElement>(null)

  // Auto-expand and select role from location state (e.g., coming back from interview)
  const appliedLocationState = useRef(false)
  useEffect(() => {
    if (appliedLocationState.current) return
    const state = location.state as { companyProfileId?: string; roleId?: string } | null
    if (state?.roleId && roles.length > 0) {
      appliedLocationState.current = true
      const role = roles.find((r) => r.id === state.roleId)
      if (role && dbCompanies.length > 0) {
        const company = dbCompanies.find((c) => c.id === state.companyProfileId)
        if (company && !activeContext.find((ctx) => ctx.role?.id === role.id)) {
          setActiveContext((prev) => [...prev, { company, role }])
        }
      }
    }
  }, [location.state, roles, dbCompanies, activeContext])

  useEffect(() => {
    if (location.state?.newCompanyId && dbCompanies.length > 0) {
      const newCompany = dbCompanies.find((c) => c.id === location.state.newCompanyId)
      if (newCompany && !searchQuery) {
        setSearchQuery(newCompany.name)
        const newState = { ...location.state }
        delete newState.newCompanyId
        navigate(location.pathname, { replace: true, state: newState });
      }
    }
  }, [location.state, dbCompanies, navigate, location.pathname, searchQuery])
  const userInitial = user?.email?.[0].toUpperCase() ?? '?'

  // Derive active context for the chat hook
  const activeRole = activeContext.length === 1 ? activeContext[0].role : undefined
  const activeCompanyProfileId = activeContext.length === 1 ? activeContext[0].company.id : undefined
  const companyNames = activeContext.map((ctx) => ctx.company.name)
  const { messages, isStreaming, sendMessage } = useResearchChat({
    companies: companyNames,
    jobDescription: activeRole?.jobDescription || undefined,
    companyProfileId: activeCompanyProfileId || null,
    roleId: activeRole?.id || null,
  })

  const filteredCompanies = dbCompanies
    .filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite))

  const handleToggleFavorite = (id: string) => {
    toggleFavorite(id)
  }

  const handleDeleteCompany = async () => {
    if (!companyToDelete) return;
    const { id, name } = companyToDelete;
    try {
        await deleteCompany(id)
        setToastConfig({ message: `Removed ${name} from your board`, variant: 'error' })
    } catch (error) {
        console.error(`Failed to delete company ${id}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Please try again later.';
        setToastConfig({ message: `Failed to delete ${name}: ${errorMessage}`, variant: 'error' })
    }
    setCompanyToDelete(null);
  }

  function handleDragStart(company: CompanyProfile) {
    draggingCompany.current = company
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const company = draggingCompany.current
    if (!company) return
    if (!activeContext.find((ctx) => ctx.company.id === company.id && !ctx.role)) {
      setActiveContext((prev) => [...prev, { company }])
    }
    draggingCompany.current = null
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }

  function removeFromContext(companyId: string, roleId?: string) {
    setActiveContext((prev) =>
      prev.filter((ctx) => !(ctx.company.id === companyId && ctx.role?.id === roleId))
    )
  }

  function handleSend() {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return
    setInput('')
    sendMessage(trimmed)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleToggleExpand(companyId: string) {
    setExpandedCompanyId((prev) => (prev === companyId ? null : companyId))
    setIsAddingRole(false)
    setNewRoleTitle('')
    setNewRoleJd('')
  }

  function handleSelectRole(company: CompanyProfile, role: CompanyRole) {
    // Add role to context if not already there
    if (!activeContext.find((ctx) => ctx.role?.id === role.id)) {
      setActiveContext((prev) => [...prev, { company, role }])
    }
  }

  function handleStartInterview(company: CompanyProfile, role: CompanyRole) {
    navigate('/interview', {
      state: {
        companyName: company.name,
        companyProfileId: company.id,
        roleId: role.id,
        roleTitle: role.roleTitle,
        jobDescription: role.jobDescription || '',
      },
    })
  }

  async function handleAddRole() {
    const title = newRoleTitle.trim()
    if (!title) return
    const result = await addRole(title, newRoleJd || undefined)
    if (result) {
      setToastConfig({ message: `Added role "${title}"`, variant: 'success' })
    }
    setNewRoleTitle('')
    setNewRoleJd('')
    setIsAddingRole(false)
  }

  async function handleDeleteRole(roleId: string, roleTitle: string) {
    await deleteRole(roleId)
    // Remove from active context if present
    setActiveContext((prev) => prev.filter((ctx) => ctx.role?.id !== roleId))
    setToastConfig({ message: `Removed role "${roleTitle}"`, variant: 'error' })
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Research Board</h1>
          <p className={styles.subtitle}>
            Chat with AI to analyze companies, compare roles, and build your knowledge base
          </p>
        </div>
      </div>

      <div className={styles.layout}>
        {/* Left sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.searchWrapper}>
            <Search size={14} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="Search companies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <p className={styles.sidebarLabel}>Saved Profiles</p>

          <div className={styles.companyList}>
            {filteredCompanies.map((company) => (
              <div key={company.id}>
                <div
                  className={styles.companyCard}
                  draggable
                  onDragStart={() => handleDragStart(company)}
                >
                  <button
                    className={styles.expandBtn}
                    onClick={(e) => { e.stopPropagation(); handleToggleExpand(company.id) }}
                    aria-label={expandedCompanyId === company.id ? 'Collapse' : 'Expand'}
                  >
                    {expandedCompanyId === company.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </button>
                  <CompanyLogo company={company} styles={styles} />
                  <div className={styles.companyInfo}>
                    <span className={styles.companyName}>{company.name}</span>
                    <span
                      className={cn(
                        styles.categoryBadge,
                        CATEGORY_STYLE[company.category] ?? styles.categoryDefault,
                      )}
                    >
                      {company.category}
                    </span>
                  </div>
                  <button
                    className={cn(styles.starBtn, company.isFavorite && styles.starBtnActive)}
                    onClick={(e) => { e.stopPropagation(); handleToggleFavorite(company.id) }}
                    aria-label={company.isFavorite ? 'Unfavorite' : 'Favorite'}
                  >
                    <Star size={13} />
                  </button>
                  <button
                    className={styles.deleteBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCompanyToDelete({ id: company.id, name: company.name });
                    }}
                    aria-label={`Delete ${company.name}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Expandable roles list */}
                {expandedCompanyId === company.id && (
                  <div className={styles.roleList}>
                    {rolesLoading && roles.length === 0 && (
                      <p className={styles.roleEmpty}>Loading roles...</p>
                    )}
                    {!rolesLoading && roles.length === 0 && !isAddingRole && (
                      <p className={styles.roleEmpty}>No roles yet</p>
                    )}
                    {roles.map((role) => (
                      <div
                        key={role.id}
                        className={cn(
                          styles.roleItem,
                          activeContext.find((ctx) => ctx.role?.id === role.id) && styles.roleItemActive,
                        )}
                      >
                        <button
                          className={styles.roleSelectBtn}
                          onClick={() => handleSelectRole(company, role)}
                          title="Add to research context"
                        >
                          <Briefcase size={11} />
                          <span className={styles.roleName}>{role.roleTitle}</span>
                        </button>
                        <div className={styles.roleActions}>
                          <button
                            className={styles.roleInterviewBtn}
                            onClick={() => handleStartInterview(company, role)}
                            title="Start interview"
                          >
                            <Play size={11} />
                          </button>
                          <button
                            className={styles.roleDeleteBtn}
                            onClick={() => handleDeleteRole(role.id, role.roleTitle)}
                            title="Delete role"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Inline add role form */}
                    {isAddingRole ? (
                      <div className={styles.addRoleForm}>
                        <input
                          ref={roleInputRef}
                          className={styles.addRoleInput}
                          placeholder="Role title (e.g. SWE Intern)"
                          value={newRoleTitle}
                          onChange={(e) => setNewRoleTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddRole()
                            if (e.key === 'Escape') { setIsAddingRole(false); setNewRoleTitle(''); setNewRoleJd('') }
                          }}
                          autoFocus
                        />
                        <textarea
                          className={styles.addRoleJdInput}
                          placeholder="Job description (optional)"
                          value={newRoleJd}
                          onChange={(e) => setNewRoleJd(e.target.value)}
                          rows={2}
                        />
                        <div className={styles.addRoleFormActions}>
                          <button className={styles.addRoleSaveBtn} onClick={handleAddRole} disabled={!newRoleTitle.trim()}>
                            Add
                          </button>
                          <button className={styles.addRoleCancelBtn} onClick={() => { setIsAddingRole(false); setNewRoleTitle(''); setNewRoleJd('') }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className={styles.addRoleBtn}
                        onClick={() => { setIsAddingRole(true); setTimeout(() => roleInputRef.current?.focus(), 0) }}
                      >
                        <Plus size={11} />
                        Add Role
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {isLoading && filteredCompanies.length === 0 && (
              <p className={styles.noResults}>Loading companies...</p>
            )}

            {filteredCompanies.length === 0 && !isLoading && (
              <div className={styles.noResultsContainer}>
                <p className={styles.noResults}>No companies found.</p>
              </div>
            )}

            {searchQuery.trim() && (
              <div className={styles.persistentAddContainer}>
                <button
                  className={styles.addCompanyBtn}
                  onClick={() => setIsAddModalOpen(true)}
                >
                  + Add "{searchQuery}" as new company
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Chat panel */}
        <div className={styles.chatPanel}>
          {/* Active Context bar */}
          <div
            className={cn(styles.contextBar, isDragOver && styles.contextBarOver)}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <span className={styles.contextLabel}>Active Context:</span>
            <div className={styles.contextChips}>
              {activeContext.map((ctx) => (
                <span key={`${ctx.company.id}-${ctx.role?.id || 'no-role'}`} className={styles.chip}>
                  {ctx.role ? `${ctx.company.name} \u2014 ${ctx.role.roleTitle}` : ctx.company.name}
                  <button
                    className={styles.chipRemove}
                    onClick={() => removeFromContext(ctx.company.id, ctx.role?.id)}
                    aria-label={`Remove ${ctx.company.name} from context`}
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
              <span
                className={cn(
                  styles.dropHint,
                  activeContext.length > 0 && styles.dropHintSmall,
                )}
              >
                + Drop company here
              </span>
            </div>
          </div>

          {/* Messages area */}
          <div className={styles.messages}>
            {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    styles.messageRow,
                    msg.role === 'user' ? styles.messageRowUser : styles.messageRowAssistant,
                  )}
                >
                  <div
                    className={cn(
                      styles.message,
                      msg.role === 'user' ? styles.messageUser : styles.messageAssistant,
                    )}
                  >
                    {msg.content}
                  </div>
                  {msg.role === 'user' && (
                    <span className={styles.avatar}>{userInitial}</span>
                  )}
                </div>
              ))}
          </div>

          {/* Input bar */}
          <div className={styles.inputBar}>
            <button className={styles.attachBtn} aria-label="Attach file">
              <Paperclip size={16} />
            </button>
            <input
              className={styles.chatInput}
              placeholder="Ask about culture, prep for interviews, or drag a company here..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              className={cn(
                styles.sendBtn,
                input.trim() && activeContext.length > 0 && !isStreaming && styles.sendBtnActive,
              )}
              onClick={handleSend}
              disabled={!input.trim() || activeContext.length === 0 || isStreaming}
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>

      <AddCompanyModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        initialCompanyName={searchQuery}
        onSuccess={async (_newId, newName) => {
          setIsAddModalOpen(false);
          setSearchQuery(newName);
          await refreshCompanies();
          setToastConfig({ message: `Added ${newName} to your board!`, variant: 'success' })
        }}
      />
      <ConfirmModal
        isOpen={!!companyToDelete}
        title="Delete Company"
        message={`Are you sure you want to remove "${companyToDelete?.name}" from your board? This action cannot be undone.`}
        confirmText="Delete"
        onCancel={() => setCompanyToDelete(null)}
        onConfirm={handleDeleteCompany}
      />
      {/* Toast Component */}
      {toastConfig && (
        <StandardToast
          message={toastConfig.message}
          variant={toastConfig.variant}
          onDone={() => setToastConfig(null)}
        />
      )}
    </div>
  )
}
