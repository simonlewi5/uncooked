import { useState, useRef } from 'react'
import { Plus, Search, Send, GripVertical, X, Paperclip, User } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/utils/cn'
import styles from './ResearchPage.module.css'

interface CompanyProfile {
  id: string
  name: string
  category: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const MOCK_COMPANIES: CompanyProfile[] = [
  { id: '1', name: 'Stripe', category: 'Fintech' },
  { id: '2', name: 'Vercel', category: 'DevTools' },
  { id: '3', name: 'OpenAI', category: 'AI/ML' },
]

const CATEGORY_STYLE: Record<string, string> = {
  Fintech: styles.categoryFintech,
  DevTools: styles.categoryDevtools,
  'AI/ML': styles.categoryAiml,
}

export default function ResearchPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeContext, setActiveContext] = useState<CompanyProfile[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const draggingCompany = useRef<CompanyProfile | null>(null)

  const filteredCompanies = MOCK_COMPANIES.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()),
  )

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
    setMessages([])
    setInput('')
  }

  function handleSend() {
    const trimmed = input.trim()
    if (!trimmed) return
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', content: trimmed },
    ])
    setInput('')
    // AI response will be wired up when the edge function is ready
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
              </div>
            ))}
            {filteredCompanies.length === 0 && (
              <p className={styles.noResults}>No companies found.</p>
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
            {messages.length === 0 ? (
              <div className={styles.emptyChat}>
                <p>Drag a company into the context bar above, then ask anything.</p>
              </div>
            ) : (
              messages.map((msg) => (
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
                    <span className={styles.avatar}><User size={14} /></span>
                  )}
                </div>
              ))
            )}
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
              className={cn(styles.sendBtn, input.trim() && styles.sendBtnActive)}
              onClick={handleSend}
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
