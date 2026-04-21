import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { Plus, Search, Send, X, Paperclip, Star, Trash2, ChevronRight, ChevronDown, Play, Briefcase } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useResearchChat } from '@/hooks/useResearchChat'
import { useResearchCompanies } from '@/hooks/useResearchCompanies'
import { useCompanyRoles } from '@/hooks/useCompanyRoles'
import { StandardToast } from '@/components/interview/Toast'
import { XpToast } from '@/components/interview/XpToast'
import AddCompanyModal from './AddCompanyPage'
import { cn } from '@/utils/cn'
import { readResearchChatAttachment } from '@/utils/readResearchChatAttachment'
import { resolveCompanyDomain } from '@/utils/companyDomain'
import { ConfirmModal } from '@/utils/ConfirmModal'
import {
  awardGamificationEvent,
  GAMIFICATION_EVENT_TYPES,
  getResearchToastTitle,
  type ResearchGamificationEventType,
} from '@/lib/gamification'
import type { Badge, CompanyRole } from '@/types'
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

const DEFAULT_ATTACHMENT_PROMPT =
  'Use the attached file as context and respond in relation to the companies in context.'

const CATEGORY_STYLE: Record<string, string> = {
  Technology: styles.categoryTechnology,
  Fintech: styles.categoryFintech,
  DevTools: styles.categoryDevtools,
  'AI/ML': styles.categoryAiml,
  Healthcare: styles.categoryHealthcare,
  'E-commerce': styles.categoryEcommerce,
  SaaS: styles.categorySaas,
}

function CompanyLogo({ company, styles }: { company: CompanyProfile; styles: Record<string, string> }) {
  const [hasError, setHasError] = useState(false)
  const domain = resolveCompanyDomain(company.name, company.company_website ?? null)
  if (!domain || hasError) {
    return <div className={styles.logoFallback}>{company.name.charAt(0).toUpperCase()}</div>
  }
  return (
    <img
      src={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/company-logo?domain=${encodeURIComponent(domain)}`}
      alt={`${company.name} logo`}
      className={styles.logoImage}
      onError={() => setHasError(true)}
    />
  )
}

export default function ResearchPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchQuery, setSearchQuery] = useState(() => location.state?.companyName || '')
  const CONTEXT_KEY = 'research_active_context'
  const [activeContext, setActiveContext] = useState<ActiveContextItem[]>([])
  const [input, setInput] = useState('')
  const [attachment, setAttachment] = useState<{ name: string; excerpt: string } | null>(null)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const { user } = useAuth()
  const { companies: dbCompanies, isLoading, toggleFavorite, deleteCompany, refreshCompanies } =
    useResearchCompanies()
  const [toastConfig, setToastConfig] = useState<{
    message: string
    variant: 'success' | 'error'
  } | null>(null)
  const [companyToDelete, setCompanyToDelete] = useState<{ id: string; name: string } | null>(null)

  type GamificationToastItem =
    | { id: number; variant: 'xp'; xp: number; label: string }
    | { id: number; variant: 'achievement'; label: string }
  const [gamificationToasts, setGamificationToasts] = useState<GamificationToastItem[]>([])
  const pushGamificationToast = useCallback((item: GamificationToastItem) => {
    setGamificationToasts((prev) => [...prev, item])
  }, [])

  const queueResearchGamification = useCallback(
    (eventType: ResearchGamificationEventType) => {
      if (!user?.id) return
      void awardGamificationEvent(user.id, eventType).then((result) => {
        if (!result.success) return
        pushGamificationToast({ id: Date.now() + Math.random(), variant: 'xp', xp: result.xpAwarded, label: getResearchToastTitle(eventType) })
        result.newBadges.forEach((badge: Badge, i: number) => {
          window.setTimeout(() => {
            pushGamificationToast({ id: Date.now() + Math.random(), variant: 'achievement', label: `${badge.icon} ${badge.label}` })
          }, 320 * (i + 1))
        })
      })
    },
    [user?.id, pushGamificationToast],
  )

  const handleChatXpAwarded = useCallback(
    ({ xpAwarded, newBadges }: { xpAwarded: number; newBadges: Badge[] }) => {
      pushGamificationToast({ id: Date.now() + Math.random(), variant: 'xp', xp: xpAwarded, label: getResearchToastTitle(GAMIFICATION_EVENT_TYPES.RESEARCH_CHAT_MESSAGE as ResearchGamificationEventType) })
      newBadges.forEach((badge: Badge, i: number) => {
        window.setTimeout(() => {
          pushGamificationToast({ id: Date.now() + Math.random(), variant: 'achievement', label: `${badge.icon} ${badge.label}` })
        }, 320 * (i + 1))
      })
    },
    [pushGamificationToast],
  )

  // Expandable roles state
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(
    (location.state as { companyProfileId?: string } | null)?.companyProfileId || null,
  )
  const { roles, isLoading: rolesLoading, addRole, deleteRole } = useCompanyRoles(expandedCompanyId)

  // Add role inline form state
  const [isAddingRole, setIsAddingRole] = useState(false)
  const [newRoleTitle, setNewRoleTitle] = useState('')
  const [newRoleJd, setNewRoleJd] = useState('')
  const roleInputRef = useRef<HTMLInputElement>(null)

  // Set context from location state (dashboard links).
  const appliedLocationState = useRef(false)
  useEffect(() => {
    if (appliedLocationState.current) return
    const state = location.state as { companyProfileId?: string; roleId?: string } | null
    if (!state?.companyProfileId || dbCompanies.length === 0) return

    if (state.roleId) {
      if (roles.length === 0) return
      appliedLocationState.current = true
      const company = dbCompanies.find((c) => c.id === state.companyProfileId)
      const role = roles.find((r) => r.id === state.roleId)
      if (company && role) setActiveContext([{ company, role }])
    } else {
      appliedLocationState.current = true
      const company = dbCompanies.find((c) => c.id === state.companyProfileId)
      if (company) setActiveContext([{ company }])
    }
  }, [location.state, roles, dbCompanies])

  useEffect(() => {
    if (location.state?.newCompanyId && dbCompanies.length > 0) {
      const newCompany = dbCompanies.find((c) => c.id === location.state.newCompanyId)
      if (newCompany && !searchQuery) {
        setSearchQuery(newCompany.name)
        const newState = { ...location.state }
        delete newState.newCompanyId
        navigate(location.pathname, { replace: true, state: newState })
      }
    }
  }, [location.state, dbCompanies, navigate, location.pathname, searchQuery])

  // Persist active context to sessionStorage.
  const hasSavedContextRef = useRef(false)
  useEffect(() => {
    if (!hasSavedContextRef.current && activeContext.length === 0) return
    hasSavedContextRef.current = true
    if (activeContext.length > 0) {
      sessionStorage.setItem(CONTEXT_KEY, JSON.stringify(activeContext))
    } else {
      sessionStorage.removeItem(CONTEXT_KEY)
    }
  }, [activeContext])

  // Restore active context from sessionStorage on mount once DB companies load.
  const restoredContextRef = useRef(false)
  useEffect(() => {
    if (restoredContextRef.current || dbCompanies.length === 0) return
    restoredContextRef.current = true
    hasSavedContextRef.current = true
    const state = location.state as { companyProfileId?: string } | null
    if (state?.companyProfileId) return
    const raw = sessionStorage.getItem(CONTEXT_KEY)
    if (!raw) return
    try {
      const saved = JSON.parse(raw) as ActiveContextItem[]
      const valid = saved.filter((item) => dbCompanies.some((c) => c.id === item.company.id))
      if (valid.length > 0) setActiveContext(valid)
    } catch {
      // ignore malformed data
    }
  }, [dbCompanies, location.state])

  const userInitial = user?.email?.[0].toUpperCase() ?? '?'

  const activeItem = activeContext.length === 1 ? activeContext[0] : null
  const activeRole = activeItem?.role
  const activeCompanyProfileId = activeItem?.company.id
  const companyNames = activeContext.map((ctx) => ctx.company.name)

  const { messages, isStreaming, sendMessage, resetMessages, clearSession } = useResearchChat({
    companies: companyNames,
    jobDescription: activeRole?.jobDescription || undefined,
    companyProfileId: activeCompanyProfileId || null,
    roleId: activeRole?.id || null,
    onXpAwarded: handleChatXpAwarded,
  })

  const filteredCompanies = dbCompanies
    .filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite))

  const handleToggleFavorite = (id: string) => {
    toggleFavorite(id)
  }

  const handleDeleteCompany = async () => {
    if (!companyToDelete) return
    const { id, name } = companyToDelete
    try {
      await deleteCompany(id)
      if (activeItem?.company.id === id) {
        setActiveContext([])
      }
      setToastConfig({ message: `Removed ${name} from your board`, variant: 'error' })
    } catch (error) {
      console.error(`Failed to delete company ${id}:`, error)
      const errorMessage = error instanceof Error ? error.message : 'Please try again later.'
      setToastConfig({ message: `Failed to delete ${name}: ${errorMessage}`, variant: 'error' })
    }
    setCompanyToDelete(null)
  }

  function handleSelectCompany(company: CompanyProfile) {
    const alreadySelected = activeItem?.company.id === company.id && !activeItem?.role
    if (alreadySelected) return
    resetMessages()
    setActiveContext([{ company }])
    setExpandedCompanyId(company.id)
  }

  async function handleClearChat() {
    await clearSession()
    setInput('')
    setAttachment(null)
    setAttachmentError(null)
  }

  async function handleAttachmentChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setAttachmentError(null)
    try {
      const excerpt = await readResearchChatAttachment(file)
      setAttachment({ name: file.name, excerpt })
    } catch (err) {
      setAttachment(null)
      setAttachmentError(err instanceof Error ? err.message : 'Could not read that file.')
    }
  }

  function handleSend() {
    const trimmed = input.trim()
    if ((!trimmed && !attachment) || isStreaming) return
    if (!activeContext.length) return

    const line = trimmed || (attachment ? DEFAULT_ATTACHMENT_PROMPT : '')
    const display = attachment ? `[Attached: ${attachment.name}]\n${line}` : line

    setInput('')
    setAttachment(null)
    sendMessage(display, {
      prompt: line,
      attachment: attachment ? { fileName: attachment.name, text: attachment.excerpt } : undefined,
    })
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
    const alreadySelected = activeItem?.company.id === company.id && activeItem?.role?.id === role.id
    if (alreadySelected) return
    resetMessages()
    setActiveContext([{ company, role }])
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
    if (activeItem?.role?.id === roleId) {
      resetMessages()
      setActiveContext(activeItem ? [{ company: activeItem.company }] : [])
    }
    setToastConfig({ message: `Removed role "${roleTitle}"`, variant: 'error' })
  }

  const selectedCompanyId = activeItem?.company.id
  const selectedRoleId = activeItem?.role?.id

  return (
    <div className={styles.page}>
      {gamificationToasts.map((t, i) => (
        <XpToast
          key={t.id}
          variant={t.variant}
          xp={t.variant === 'xp' ? t.xp : undefined}
          label={t.label}
          style={{ bottom: `calc(1.5rem + ${i * 3.5}rem)` }}
          onDone={() => setGamificationToasts((prev) => prev.filter((x) => x.id !== t.id))}
        />
      ))}
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
              <div
                key={company.id}
                className={cn(
                  styles.companyGroup,
                  selectedCompanyId === company.id && styles.companyGroupSelected,
                )}
              >
                <div
                  className={styles.companyCard}
                  onClick={() => handleSelectCompany(company)}
                >
                  <button
                    className={styles.expandBtn}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleExpand(company.id)
                    }}
                    aria-label={expandedCompanyId === company.id ? 'Collapse' : 'Expand'}
                  >
                    {expandedCompanyId === company.id ? (
                      <ChevronDown size={12} />
                    ) : (
                      <ChevronRight size={12} />
                    )}
                  </button>
                  <CompanyLogo company={company} styles={styles} />
                  <div className={styles.companyInfo}>
                    <span className={styles.companyName}>{company.name}</span>
                    <span
                      className={cn(
                        styles.categoryBadge,
                        CATEGORY_STYLE[company.category] ?? styles.categoryDefault,
                      )}
                      data-tooltip={company.category}
                    >
                      <span className={styles.categoryBadgeText}>
                        {company.category}
                      </span>
                    </span>
                  </div>
                  <button
                    className={cn(styles.starBtn, company.isFavorite && styles.starBtnActive)}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleFavorite(company.id)
                    }}
                    aria-label={company.isFavorite ? 'Unfavorite' : 'Favorite'}
                  >
                    <Star size={13} />
                  </button>
                  <button
                    className={styles.deleteBtn}
                    onClick={(e) => {
                      e.stopPropagation()
                      setCompanyToDelete({ id: company.id, name: company.name })
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
                          selectedCompanyId === company.id &&
                            selectedRoleId === role.id &&
                            styles.roleItemActive,
                        )}
                      >
                        <button
                          className={styles.roleSelectBtn}
                          onClick={() => handleSelectRole(company, role)}
                          title="Switch to this role's chat"
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
                            if (e.key === 'Escape') {
                              setIsAddingRole(false)
                              setNewRoleTitle('')
                              setNewRoleJd('')
                            }
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
                          <button
                            className={styles.addRoleSaveBtn}
                            onClick={handleAddRole}
                            disabled={!newRoleTitle.trim()}
                          >
                            Add
                          </button>
                          <button
                            className={styles.addRoleCancelBtn}
                            onClick={() => {
                              setIsAddingRole(false)
                              setNewRoleTitle('')
                              setNewRoleJd('')
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className={styles.addRoleBtn}
                        onClick={() => {
                          setIsAddingRole(true)
                          setTimeout(() => roleInputRef.current?.focus(), 0)
                        }}
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
                <button className={styles.addCompanyBtn} onClick={() => setIsAddModalOpen(true)}>
                  + Add "{searchQuery}" as new company
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Chat panel */}
        <div className={styles.chatPanel}>
          {/* Chat header */}
          <div className={styles.chatHeader}>
            {activeItem ? (
              <>
                <div className={styles.chatHeaderInfo}>
                  <CompanyLogo company={activeItem.company} styles={styles} />
                  <div className={styles.chatHeaderText}>
                    <span className={styles.chatHeaderName}>{activeItem.company.name}</span>
                    {activeItem.role && (
                      <span className={styles.chatHeaderRole}>{activeItem.role.roleTitle}</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.clearChatBtn}
                  onClick={handleClearChat}
                  disabled={isStreaming}
                >
                  Clear chat
                </button>
              </>
            ) : (
              <span className={styles.chatHeaderEmpty}>
                Select a company to start researching
              </span>
            )}
          </div>

          {/* Messages area */}
          {activeItem ? (
            <div className={styles.messages}>
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    styles.messageRow,
                    m.role === 'user' ? styles.messageRowUser : styles.messageRowAssistant,
                  )}
                >
                  <div
                    className={cn(
                      styles.message,
                      m.role === 'user' ? styles.messageUser : styles.messageAssistant,
                    )}
                  >
                    {m.role === 'assistant' ? (
                      <div className={styles.markdown}>
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    ) : (
                      m.content
                    )}
                  </div>
                  {m.role === 'user' && <span className={styles.avatar}>{userInitial}</span>}
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyChatState}>
              <p>Select a company from the sidebar to start your research chat</p>
            </div>
          )}

          <div className={styles.inputArea}>
            {attachment && (
              <div className={styles.attachRow}>
                <span className={styles.attachChip}>
                  <Paperclip size={12} aria-hidden />
                  <span className={styles.attachChipName}>{attachment.name}</span>
                  <button
                    type="button"
                    className={styles.attachChipRemove}
                    onClick={() => {
                      setAttachment(null)
                      setAttachmentError(null)
                    }}
                    aria-label="Remove attachment"
                  >
                    <X size={12} />
                  </button>
                </span>
              </div>
            )}
            {attachmentError && <p className={styles.attachError}>{attachmentError}</p>}
            <div className={styles.inputBar}>
              <input
                ref={fileInputRef}
                type="file"
                className={styles.fileInputHidden}
                accept=".pdf,.txt,.md,.csv,.json,.tsv,.markdown,text/*,application/pdf,application/json"
                aria-hidden
                tabIndex={-1}
                onChange={handleAttachmentChange}
              />
              <button
                type="button"
                className={styles.attachBtn}
                aria-label="Attach file"
                disabled={!activeItem || isStreaming}
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip size={16} />
              </button>
              <input
                className={styles.chatInput}
                placeholder={
                  activeItem
                    ? `Ask about ${activeItem.company.name}…`
                    : 'Select a company to start chatting…'
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!activeItem || isStreaming}
              />
              <button
                type="button"
                className={cn(
                  styles.sendBtn,
                  (input.trim() || attachment) &&
                    activeContext.length > 0 &&
                    !isStreaming &&
                    styles.sendBtnActive,
                )}
                onClick={handleSend}
                disabled={(!input.trim() && !attachment) || activeContext.length === 0 || isStreaming}
                aria-label="Send message"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <AddCompanyModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        initialCompanyName={searchQuery}
        onSuccess={async (_newId, newName) => {
          setIsAddModalOpen(false)
          setSearchQuery(newName)
          await refreshCompanies()
          setToastConfig({ message: `Added ${newName} to your board!`, variant: 'success' })
          queueResearchGamification(GAMIFICATION_EVENT_TYPES.RESEARCH_COMPANY_ADDED as ResearchGamificationEventType)
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
