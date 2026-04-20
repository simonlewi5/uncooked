import { useState, useEffect } from 'react'
import { Plus, X, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui'
import { ConfirmModal } from '@/utils/ConfirmModal'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { cn } from '@/utils/cn'
import styles from './PipelinePage.module.css'

type ApplicationStatus =
  | 'saved'
  | 'applied'
  | 'phone_screen'
  | 'interviewing'
  | 'offer'
  | 'rejected'
  | 'withdrawn'

interface JobApplication {
  id: string
  jobTitle: string
  companyName: string
  jobUrl: string | null
  jobDescription: string | null
  notes: string | null
  status: ApplicationStatus
  appliedAt: string | null
  createdAt: string
}

interface AddFormState {
  jobTitle: string
  companyName: string
  jobUrl: string
  jobDescription: string
  notes: string
  status: ApplicationStatus
}

const COLUMNS: { key: string; label: string; statuses: ApplicationStatus[] }[] = [
  { key: 'saved', label: 'Saved', statuses: ['saved'] },
  { key: 'applied', label: 'Applied', statuses: ['applied'] },
  { key: 'phone_screen', label: 'Phone Screen', statuses: ['phone_screen'] },
  { key: 'interviewing', label: 'Interviewing', statuses: ['interviewing'] },
  { key: 'offer', label: 'Offer', statuses: ['offer'] },
  { key: 'closed', label: 'Closed', statuses: ['rejected', 'withdrawn'] },
]

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  phone_screen: 'Phone Screen',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

const ALL_STATUSES: ApplicationStatus[] = [
  'saved', 'applied', 'phone_screen', 'interviewing', 'offer', 'rejected', 'withdrawn',
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const ACCENT_COUNT = 4

function accentIndex(companyName: string): number {
  let hash = 0
  for (let i = 0; i < companyName.length; i++) {
    hash = (hash * 31 + companyName.charCodeAt(i)) >>> 0
  }
  return hash % ACCENT_COUNT
}

export default function PipelinePage() {
  const { user } = useAuth()
  const [applications, setApplications] = useState<JobApplication[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState<AddFormState>({
    jobTitle: '', companyName: '', jobUrl: '', jobDescription: '', notes: '', status: 'saved',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<JobApplication | null>(null)
  const [editTarget, setEditTarget] = useState<JobApplication | null>(null)
  const [editForm, setEditForm] = useState<AddFormState>({ jobTitle: '', companyName: '', jobUrl: '', jobDescription: '', notes: '', status: 'saved' })
  const [isUpdating, setIsUpdating] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id) return
    const userId = user.id

    async function loadApplications() {
      setIsLoading(true)
      setError(null)
      const { data, error: err } = await supabase
        .from('job_applications')
        .select('id, job_title, company_name, job_url, job_description, notes, status, applied_at, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (err) {
        setError('Failed to load applications.')
      } else {
        setApplications(
          (data ?? []).map((row) => ({
            id: row.id,
            jobTitle: row.job_title,
            companyName: row.company_name ?? '',
            jobUrl: row.job_url,
            jobDescription: row.job_description,
            notes: row.notes,
            status: row.status as ApplicationStatus,
            appliedAt: row.applied_at,
            createdAt: row.created_at,
          }))
        )
      }
      setIsLoading(false)
    }

    void loadApplications()
  }, [user?.id])

  async function handleAdd() {
    if (!user?.id || !addForm.jobTitle.trim() || !addForm.companyName.trim()) return
    setIsSaving(true)
    const { data, error: err } = await supabase
      .from('job_applications')
      .insert({
        user_id: user.id,
        job_title: addForm.jobTitle.trim(),
        company_name: addForm.companyName.trim(),
        job_url: addForm.jobUrl.trim() || null,
        job_description: addForm.jobDescription.trim() || null,
        notes: addForm.notes.trim() || null,
        status: addForm.status,
      })
      .select('id, job_title, company_name, job_url, job_description, notes, status, applied_at, created_at')
      .single()

    if (!err && data) {
      setApplications((prev) => [
        {
          id: data.id,
          jobTitle: data.job_title,
          companyName: data.company_name ?? '',
          jobUrl: data.job_url,
          jobDescription: data.job_description,
          notes: data.notes,
          status: data.status as ApplicationStatus,
          appliedAt: data.applied_at,
          createdAt: data.created_at,
        },
        ...prev,
      ])
      setShowAddModal(false)
      setAddForm({ jobTitle: '', companyName: '', jobUrl: '', jobDescription: '', notes: '', status: 'saved' })
    }
    setIsSaving(false)
  }

  async function handleStatusChange(id: string, status: ApplicationStatus) {
    setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)))
    await supabase.from('job_applications').update({ status }).eq('id', id)
  }

  function openEdit(app: JobApplication) {
    setEditTarget(app)
    setEditForm({
      jobTitle: app.jobTitle,
      companyName: app.companyName,
      jobUrl: app.jobUrl ?? '',
      jobDescription: app.jobDescription ?? '',
      notes: app.notes ?? '',
      status: app.status,
    })
  }

  async function handleUpdate() {
    if (!editTarget || !editForm.jobTitle.trim() || !editForm.companyName.trim()) return
    setIsUpdating(true)
    const { error: err } = await supabase
      .from('job_applications')
      .update({
        job_title: editForm.jobTitle.trim(),
        company_name: editForm.companyName.trim(),
        job_url: editForm.jobUrl.trim() || null,
        job_description: editForm.jobDescription.trim() || null,
        notes: editForm.notes.trim() || null,
        status: editForm.status,
      })
      .eq('id', editTarget.id)

    if (!err) {
      setApplications((prev) =>
        prev.map((a) =>
          a.id === editTarget.id
            ? { ...a, jobTitle: editForm.jobTitle.trim(), companyName: editForm.companyName.trim(), jobUrl: editForm.jobUrl.trim() || null, jobDescription: editForm.jobDescription.trim() || null, notes: editForm.notes.trim() || null, status: editForm.status }
            : a
        )
      )
      setEditTarget(null)
    }
    setIsUpdating(false)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await supabase.from('job_applications').delete().eq('id', deleteTarget.id)
    setApplications((prev) => prev.filter((a) => a.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  function handleDragStart(id: string) {
    setDragId(id)
  }

  function handleDrop(columnKey: string) {
    if (!dragId) return
    const col = COLUMNS.find((c) => c.key === columnKey)
    if (!col) return
    const targetStatus = col.statuses[0]
    void handleStatusChange(dragId, targetStatus)
    setDragId(null)
    setDragOverCol(null)
  }

  const colApps = (col: typeof COLUMNS[number]) =>
    applications.filter((a) => col.statuses.includes(a.status))

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Applications</h1>
          <p className={styles.subtitle}>Track your job applications from start to finish.</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
          <Plus size={14} /> Add Application
        </Button>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {isLoading ? (
        <div className={styles.loadingState}>Loading applications…</div>
      ) : (
        <div className={styles.board}>
          {COLUMNS.map((col) => {
            const cards = colApps(col)
            const isOver = dragOverCol === col.key
            return (
              <div
                key={col.key}
                className={cn(styles.column, isOver && styles.columnOver)}
                onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.key) }}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={() => handleDrop(col.key)}
              >
                <div className={styles.colHeader}>
                  <span className={styles.colLabel}>{col.label}</span>
                  <span className={styles.colCount}>{cards.length}</span>
                </div>
                <div className={styles.cardList}>
                  {cards.length === 0 && (
                    <div className={styles.emptyCol}>Drop here</div>
                  )}
                  {cards.map((app) => (
                    <div
                      key={app.id}
                      className={cn(styles.card, col.key === 'offer' && 'iris-glow')}
                      data-accent={accentIndex(app.companyName)}
                      draggable
                      onClick={() => openEdit(app)}
                      onDragStart={() => handleDragStart(app.id)}
                      onDragEnd={() => { setDragId(null); setDragOverCol(null) }}
                    >
                      <div className={styles.cardTop}>
                        <p className={styles.cardTitle}>{app.jobTitle}</p>
                        <button
                          className={styles.cardDelete}
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(app) }}
                          aria-label="Delete application"
                        >
                          <X size={12} />
                        </button>
                      </div>
                      <p className={styles.cardCompany}>{app.companyName}</p>
                      {app.notes && <p className={styles.cardNotes}>{app.notes}</p>}
                      <div className={styles.cardFooter}>
                        <span className={styles.cardDate}>
                          {formatDate(app.appliedAt ?? app.createdAt)}
                        </span>
                        <div className={styles.cardActions}>
                          {app.jobUrl && (
                            <a
                              href={app.jobUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.cardLink}
                              aria-label="Open job posting"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink size={12} />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add application modal */}
      {showAddModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Add Application</h2>
              <button className={styles.modalClose} onClick={() => setShowAddModal(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <label className={styles.fieldLabel}>
                <span>Job Title <span className={styles.required}>*</span></span>
                <input
                  className={styles.fieldInput}
                  placeholder="e.g. Senior Frontend Engineer"
                  value={addForm.jobTitle}
                  onChange={(e) => setAddForm((f) => ({ ...f, jobTitle: e.target.value }))}
                />
              </label>
              <label className={styles.fieldLabel}>
                <span>Company <span className={styles.required}>*</span></span>
                <input
                  className={styles.fieldInput}
                  placeholder="e.g. Stripe"
                  value={addForm.companyName}
                  onChange={(e) => setAddForm((f) => ({ ...f, companyName: e.target.value }))}
                />
              </label>
              <label className={styles.fieldLabel}>
                Job URL
                <input
                  className={styles.fieldInput}
                  placeholder="https://..."
                  value={addForm.jobUrl}
                  onChange={(e) => setAddForm((f) => ({ ...f, jobUrl: e.target.value }))}
                />
              </label>
              <label className={styles.fieldLabel}>
                Job Description
                <textarea
                  className={cn(styles.fieldInput, styles.fieldTextarea)}
                  placeholder="Paste the job description here..."
                  value={addForm.jobDescription}
                  onChange={(e) => setAddForm((f) => ({ ...f, jobDescription: e.target.value }))}
                />
              </label>
              <label className={styles.fieldLabel}>
                Status
                <select
                  className={styles.fieldInput}
                  value={addForm.status}
                  onChange={(e) => setAddForm((f) => ({ ...f, status: e.target.value as ApplicationStatus }))}
                >
                  {ALL_STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </label>
              <label className={styles.fieldLabel}>
                Notes
                <textarea
                  className={cn(styles.fieldInput, styles.fieldTextarea)}
                  placeholder="Any notes about this role..."
                  value={addForm.notes}
                  onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </label>
            </div>
            <div className={styles.modalFooter}>
              <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={handleAdd}
                loading={isSaving}
                disabled={!addForm.jobTitle.trim() || !addForm.companyName.trim()}
              >
                Add
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit application modal */}
      {editTarget && (
        <div className={styles.modalOverlay} onClick={() => setEditTarget(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Edit Application</h2>
              <button className={styles.modalClose} onClick={() => setEditTarget(null)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <label className={styles.fieldLabel}>
                <span>Job Title <span className={styles.required}>*</span></span>
                <input
                  className={styles.fieldInput}
                  value={editForm.jobTitle}
                  onChange={(e) => setEditForm((f) => ({ ...f, jobTitle: e.target.value }))}
                />
              </label>
              <label className={styles.fieldLabel}>
                <span>Company <span className={styles.required}>*</span></span>
                <input
                  className={styles.fieldInput}
                  value={editForm.companyName}
                  onChange={(e) => setEditForm((f) => ({ ...f, companyName: e.target.value }))}
                />
              </label>
              <label className={styles.fieldLabel}>
                Job URL
                <input
                  className={styles.fieldInput}
                  placeholder="https://..."
                  value={editForm.jobUrl}
                  onChange={(e) => setEditForm((f) => ({ ...f, jobUrl: e.target.value }))}
                />
              </label>
              <label className={styles.fieldLabel}>
                Job Description
                <textarea
                  className={cn(styles.fieldInput, styles.fieldTextarea)}
                  placeholder="Paste the job description here..."
                  value={editForm.jobDescription}
                  onChange={(e) => setEditForm((f) => ({ ...f, jobDescription: e.target.value }))}
                />
              </label>
              <label className={styles.fieldLabel}>
                Status
                <select
                  className={styles.fieldInput}
                  value={editForm.status}
                  onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as ApplicationStatus }))}
                >
                  {ALL_STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </label>
              <label className={styles.fieldLabel}>
                Notes
                <textarea
                  className={cn(styles.fieldInput, styles.fieldTextarea)}
                  placeholder="Any notes about this role..."
                  value={editForm.notes}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </label>
            </div>
            <div className={styles.modalFooter}>
              <Button variant="secondary" onClick={() => setEditTarget(null)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={handleUpdate}
                loading={isUpdating}
                disabled={!editForm.jobTitle.trim() || !editForm.companyName.trim()}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Application"
        message={`Remove "${deleteTarget?.jobTitle}" at ${deleteTarget?.companyName} from your pipeline?`}
        confirmText="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
