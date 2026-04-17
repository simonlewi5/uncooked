import { useState, useRef, useEffect } from 'react'
import { Plus, Search, Send, GripVertical, X, Paperclip, Star, Trash2 } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { useResearchChat } from '@/hooks/useResearchChat'
import { useResearchCompanies } from '@/hooks/useResearchCompanies'
import { cn } from '@/utils/cn'
import { readResearchChatAttachment } from '@/utils/readResearchChatAttachment'
import styles from './ResearchPage.module.css'

interface CompanyProfile {
  id: string
  name: string
  category: string
  isFavorite: boolean
  company_website?: string
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
  const [activeContext, setActiveContext] = useState<CompanyProfile[]>([])
  const [input, setInput] = useState('')
  const [attachment, setAttachment] = useState<{ name: string; excerpt: string } | null>(null)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // const [companies, setCompanies] = useState<CompanyProfile[]>(MOCK_COMPANIES)
  const [isDragOver, setIsDragOver] = useState(false)
  const draggingCompany = useRef<CompanyProfile | null>(null)
  const { user } = useAuth()
  const { companies: dbCompanies, isLoading, toggleFavorite, deleteCompany } = useResearchCompanies()
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

  const companyNames = activeContext.map((c) => c.name)
  const { messages, isStreaming, sendMessage, resetMessages } = useResearchChat({
    companies: companyNames,
    jobDescription: undefined,
  })

  const filteredCompanies = dbCompanies
    .filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite))
  const handleToggleFavorite = (id: string) => {
    toggleFavorite(id)
  }
  // function toggleFavorite(id: string) {
  //   setCompanies((prev) =>
  //     prev.map((c) => (c.id === id ? { ...c, isFavorite: !c.isFavorite } : c)),
  //   )
  // }
  const handleDeleteCompany = async (id: string, name: string) => {
  if (confirm(`Delete "${name}" from your saved companies?`)) {
    await deleteCompany(id)
    }
  }

  function handleDragStart(company: CompanyProfile) {
    draggingCompany.current = company
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const company = draggingCompany.current
    if (!company) return
    if (!activeContext.find((c) => c.id === company.id)) {
      setActiveContext((prev) => [...prev, company])
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

  function removeFromContext(id: string) {
    setActiveContext((prev) => prev.filter((c) => c.id !== id))
  }

  function handleNewBoard() {
    setActiveContext([])
    resetMessages()
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

    const defaultAsk =
      'Use the attached file as context and respond in relation to the companies in context.'
    const displayLine = trimmed || defaultAsk
    const displayContent = attachment ? `[Attached: ${attachment.name}]\n${displayLine}` : displayLine

    setInput('')
    setAttachment(null)
    sendMessage(displayContent, {
      prompt: displayLine,
      attachment: attachment ? { fileName: attachment.name, text: attachment.excerpt } : undefined,
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
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
        <Button variant="primary" size="sm" onClick={handleNewBoard}>
          <Plus size={14} />
          New Board
        </Button>
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

          <p className={styles.sidebarLabel}>Saved Profiles (Drag to Chat)</p>

          <div className={styles.companyList}>
            {filteredCompanies.map((company) => (
              <div
                key={company.id}
                className={styles.companyCard}
                draggable
                onDragStart={() => handleDragStart(company)}
              >
                <GripVertical size={14} className={styles.dragHandle} />
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
                  onClick={(e) => { e.stopPropagation(); handleDeleteCompany(company.id, company.name) }}
                  aria-label={`Delete ${company.name}`}
                >
                  <Trash2 size={13} />
                </button>
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
                  onClick={() => navigate('/add-company', { state: { companyName: searchQuery } })}
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
              {activeContext.map((company) => (
                <span key={company.id} className={styles.chip}>
                  {company.name}
                  <button
                    className={styles.chipRemove}
                    onClick={() => removeFromContext(company.id)}
                    aria-label={`Remove ${company.name} from context`}
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
                disabled={isStreaming}
                onClick={() => fileInputRef.current?.click()}
              >
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
    </div>
  )
}
