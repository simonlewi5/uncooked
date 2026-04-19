import { useState, useEffect, useRef, KeyboardEvent, useCallback } from 'react'
import html2pdf from 'html2pdf.js'
import { Download, Sparkles, Search, X, Plus, FileUp } from 'lucide-react'
import { Button } from '@/components/ui'
import { XpToast } from '@/components/interview/XpToast'
import { ResumeSuggestionsPanel } from '@/components/resume/ResumeSuggestionsPanel'
import {
  applySuggestion,
  buildResumeSuggestionViewModels,
  findSuggestionByTargetId,
  normalizeTargetId,
  removeSuggestionByTargetId,
  type ResumeSuggestionViewModel,
} from '@/pages/resumeSuggestionTargets'
import {
  ID_GENERATORS,
  addBulletToEntry,
  addEducationEntry,
  addExperienceEntry,
  addSkillItem,
  normalizeResumeDocument,
  removeBullet,
  removeEducationEntry,
  removeExperienceEntry,
  removeSkill,
  updateBullet,
  updateEducationField,
  updateExperienceField,
  updateProfileField,
  updateSummary,
} from '@/lib/resumeMutations'
import { useResumeTailor } from '@/hooks/useResumeTailor'
import { useResumeUploadAndParse } from '@/hooks/useResumeUploadAndParse'
import { useResumePersistence } from '@/hooks/useResumePersistence'
import { useAuth } from '@/contexts/AuthContext'
import {
  awardGamificationEvent,
  GAMIFICATION_EVENT_TYPES,
  getResumeToastTitle,
  type ResumeGamificationEventType,
} from '@/lib/gamification'
import type { ResumeDocument, ResumeTailorEdit } from '@/types'
import { cn } from '@/utils/cn'
import styles from './ResumePage.module.css'

// Helper: Extract and trim text from contentEditable element
const readEditableText = (element: HTMLElement): string => {
  return (element?.textContent?.trim() || '')
}

const MOCK_RESUME = {
  name: 'Jane Doe',
  contact: 'San Francisco, CA • jane@example.com • linkedin.com/in/janedoe',
  summary:
    'Senior Frontend Engineer with 5+ years of experience building scalable web applications. Passionate about performance, accessibility, and creating pixel-perfect user interfaces using modern React and TypeScript.',
}

const MOCK_EXPERIENCE = [
  {
    id: 'e1',
    title: 'Senior Frontend Engineer',
    company: 'TechNova Solutions',
    period: '2021 – Present',
    bullets: [
      {
        id: 'e1_b1',
        text: 'Architected and migrated legacy dashboard to React/Next.js, improving page load speeds by 40%.',
      },
      {
        id: 'e1_b2',
        text: 'Mentored 3 junior developers and established frontend testing standards using Jest and Cypress.',
      },
    ],
  },
  {
    id: 'e2',
    title: 'UI Engineer',
    company: 'Brightwave Inc.',
    period: '2018 – 2021',
    bullets: [
      {
        id: 'e2_b1',
        text: 'Built reusable component library used across 6 product teams.',
      },
      {
        id: 'e2_b2',
        text: 'Led accessibility audit — brought WCAG compliance from 60% to 98%.',
      },
    ],
  },
]

const MOCK_EDUCATION = [
  { id: 'ed1', degree: 'B.S. Computer Science', school: 'UC San Diego', period: '2014 – 2018' },
]

const toInitialResumeContent = (): ResumeDocument => ({
  name: { id: ID_GENERATORS.profileName(), text: MOCK_RESUME.name },
  contact: { id: ID_GENERATORS.profileContact(), text: MOCK_RESUME.contact },
  summary: { id: ID_GENERATORS.summary(), text: MOCK_RESUME.summary },
  experience: MOCK_EXPERIENCE.map((entry) => ({
    id: entry.id,
    title: { id: ID_GENERATORS.experienceField(entry.id, 'title'), text: entry.title },
    company: { id: ID_GENERATORS.experienceField(entry.id, 'company'), text: entry.company },
    period: { id: ID_GENERATORS.experienceField(entry.id, 'period'), text: entry.period },
    bullets: entry.bullets.map((bullet) => ({
      id: ID_GENERATORS.experienceBullet(entry.id, bullet.id),
      text: bullet.text,
    })),
  })),
  education: MOCK_EDUCATION.map((entry) => ({
    id: entry.id,
    degree: { id: ID_GENERATORS.educationField(entry.id, 'degree'), text: entry.degree },
    school: { id: ID_GENERATORS.educationField(entry.id, 'school'), text: entry.school },
    period: { id: ID_GENERATORS.educationField(entry.id, 'period'), text: entry.period },
  })),
  skills: [
    { id: ID_GENERATORS.skillItem('s1'), text: 'React' },
    { id: ID_GENERATORS.skillItem('s2'), text: 'TypeScript' },
    { id: ID_GENERATORS.skillItem('s3'), text: 'Node.js' },
    { id: ID_GENERATORS.skillItem('s4'), text: 'GraphQL' },
    { id: ID_GENERATORS.skillItem('s5'), text: 'Tailwind CSS' },
  ],
})

export default function ResumePage() {
  const { user } = useAuth()
  const resumeRef = useRef<HTMLDivElement>(null)
  const [activeTargetId, setActiveTargetId] = useState<string | null>(null)
  const [resumeContent, setResumeContent] = useState<ResumeDocument>(toInitialResumeContent())
  const [jobDescription, setJobDescription] = useState('')
  const [skillInput, setSkillInput] = useState('')
  const [pendingEdits, setPendingEdits] = useState<ResumeTailorEdit[]>([])
  const [tailorRunState, setTailorRunState] = useState<'idle' | 'complete'>('idle')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [isExportingPDF, setIsExportingPDF] = useState(false)
  const [activeResumeId, setActiveResumeId] = useState<string | null>(null)
  const { runTailor, isLoading, error: tailorError, clearError } = useResumeTailor()
  const {
    loadPrimaryResume,
    saveResume,
    isLoading: isPersistenceLoading,
    error: persistenceError,
    clearError: clearPersistenceError,
  } = useResumePersistence()
  const {
    uploadAndParse,
    phase: uploadPhase,
    isLoading: isUploadLoading,
    error: uploadError,
    clearError: clearUploadError,
  } = useResumeUploadAndParse()

  const pdfInputRef = useRef<HTMLInputElement>(null)

  type GamificationToastItem =
    | { id: number; variant: 'xp'; xp: number; label: string }
    | { id: number; variant: 'achievement'; label: string }

  const [gamificationToasts, setGamificationToasts] = useState<GamificationToastItem[]>([])

  const pushGamificationToast = useCallback((item: GamificationToastItem) => {
    setGamificationToasts((prev) => [...prev, item])
  }, [])

  const queueResumeGamification = useCallback(
    (eventType: ResumeGamificationEventType, referenceId?: string | null) => {
      if (!user?.id) return
      void awardGamificationEvent(user.id, eventType, { referenceId: referenceId ?? undefined }).then(
        (result) => {
          if (!result.success) return
          pushGamificationToast({
            id: Date.now() + Math.random(),
            variant: 'xp',
            xp: result.xpAwarded,
            label: getResumeToastTitle(eventType),
          })
          result.newBadges.forEach((badge, i) => {
            window.setTimeout(() => {
              pushGamificationToast({
                id: Date.now() + Math.random(),
                variant: 'achievement',
                label: `${badge.icon} ${badge.label}`,
              })
            }, 320 * (i + 1))
          })
        },
      )
    },
    [user?.id, pushGamificationToast],
  )

  // ── Local helpers for contentEditable field updates ──
  const handleUpdateProfileField = (field: 'name' | 'contact', text: string) => {
    setResumeContent((prev) => updateProfileField(prev, field, text))
  }

  const handleUpdateSummary = (text: string) => {
    setResumeContent((prev) => updateSummary(prev, text))
  }

  const handleUpdateExperienceField = (expId: string, field: 'title' | 'company' | 'period', text: string) => {
    setResumeContent((prev) => updateExperienceField(prev, expId, field, text))
  }

  const handleUpdateEducationField = (eduId: string, field: 'degree' | 'school' | 'period', text: string) => {
    setResumeContent((prev) => updateEducationField(prev, eduId, field, text))
  }

  const handleUpdateBullet = (expId: string, bulletId: string, text: string) => {
    setResumeContent((prev) => updateBullet(prev, expId, bulletId, text))
  }

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!user?.id) return
      clearPersistenceError()

      try {
        const existing = await loadPrimaryResume(user.id)
        if (cancelled || !existing?.structuredContent) return
        setResumeContent(normalizeResumeDocument(existing.structuredContent))
        setActiveResumeId(existing.id)
      } catch {
        // error surfaced through persistenceError
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [user?.id, loadPrimaryResume, clearPersistenceError])

  async function handlePdfImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const inputElement = e.currentTarget
    if (!file) return

    setSubmitError(null)
    clearUploadError()

    if (!user?.id) {
      setSubmitError('You must be signed in to upload and parse a resume.')
      inputElement.value = ''
      return
    }

    const saved = await uploadAndParse({
      userId: user.id,
      file,
      title: file.name,
      isPrimary: true,
    })

    if (saved?.structuredContent) {
      setResumeContent(normalizeResumeDocument(saved.structuredContent))
      setActiveResumeId(saved.id)
      setPendingEdits([])
      queueResumeGamification(GAMIFICATION_EVENT_TYPES.RESUME_SESSION_UPLOAD, saved.id)
      setSubmitError(
        saved.status === 'partial'
          ? 'Resume imported with partial parsing. Please review and edit extracted sections.'
          : null
      )
    } else {
      setSubmitError(`Could not parse "${file.name}". Please try a different file.`)
    }

    if (inputElement) {
      inputElement.value = ''
    }
  }

  function addExperience() {
    setResumeContent((prev) => addExperienceEntry(prev))
  }

  function removeExperience(id: string) {
    setResumeContent((prev) => removeExperienceEntry(prev, id))
  }

  function addBullet(expId: string) {
    setResumeContent((prev) => addBulletToEntry(prev, expId))
  }

  function addEducation() {
    setResumeContent((prev) => addEducationEntry(prev))
  }

  function removeEducation(id: string) {
    setResumeContent((prev) => removeEducationEntry(prev, id))
  }

  function handleSkillKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      const trimmed = skillInput.trim()
      const isDuplicate = resumeContent.skills.some(
        (skill) => skill.text.toLowerCase() === trimmed.toLowerCase()
      )
      if (trimmed && !isDuplicate) {
        setResumeContent((prev) => addSkillItem(prev, trimmed))
      }
      setSkillInput('')
    }
  }

  const applyEditByTargetId = (targetId: string) => {
    const normalizedTargetId = normalizeTargetId(targetId)
    const edit = findSuggestionByTargetId(pendingEdits, normalizedTargetId)
    if (!edit) return false

    const { nextContent, applied, targetResolution } = applySuggestion(resumeContent, edit)
    if (targetResolution?.source === 'fallback') {
      console.warn('resume-tailor target resolved through fallback path', {
        requestedTargetId: normalizedTargetId,
        resolvedTargetId: targetResolution.targetId,
      })
    }

    if (applied) {
      setResumeContent(nextContent)
    }

    setPendingEdits((prev) => removeSuggestionByTargetId(prev, normalizedTargetId))
    return applied
  }

  async function handleAutoTailor() {
    clearError()
    clearUploadError()
    clearPersistenceError()
    setSubmitError(null)
    setTailorRunState('idle')

    if (jobDescription.trim().length < 200) {
      setSubmitError('Please paste a longer job description (minimum 200 characters).')
      return
    }

    const result = await runTailor({ jobDescription, resumeContent, mode: 'delta_only' })

    if (result.status === 'error') return

    setPendingEdits(result.edits)
    setTailorRunState('complete')
    queueResumeGamification(GAMIFICATION_EVENT_TYPES.RESUME_AUTO_TAILOR)
  }

  async function handleExportPDF() {
    if (!resumeRef.current) return

    try {
      setIsExportingPDF(true)

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })

      await html2pdf()
        .set({
          margin: [10, 10, 10, 10],
          filename: 'resume_export.pdf',
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(resumeRef.current)
        .save()
    } finally {
      setIsExportingPDF(false)
    }
  }

  async function handleSaveResume() {
    clearPersistenceError()
    setSubmitError(null)

    if (!activeResumeId) {
      setSubmitError('Upload and parse a resume first before saving changes.')
      return
    }

    try {
      await saveResume(activeResumeId, resumeContent, 'edited')
    } catch {
      // error surfaced through persistenceError
    }
  }

  const editable = !isPreviewMode && !isExportingPDF
  const suggestionItems: ResumeSuggestionViewModel[] = buildResumeSuggestionViewModels(resumeContent, pendingEdits)
  const suggestionPanelState = tailorRunState === 'idle' ? 'idle' : tailorRunState
  const pageError = submitError ?? uploadError ?? persistenceError ?? tailorError

  const handleRevealTarget = useCallback((targetId: string) => {
    const normalizedTargetId = normalizeTargetId(targetId)
    setActiveTargetId(normalizedTargetId)

    const targetElement = resumeRef.current?.querySelector<HTMLElement>(`[data-target-id="${normalizedTargetId}"]`)
    targetElement?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
  }, [])

  const handleAcceptTarget = (targetId: string) => {
    const normalizedTargetId = normalizeTargetId(targetId)
    const applied = applyEditByTargetId(normalizedTargetId)
    if (applied) {
      queueResumeGamification(GAMIFICATION_EVENT_TYPES.RESUME_APPLY_TAILOR_EDIT)
    }
    setActiveTargetId((current) => (current === normalizedTargetId ? null : current))
  }

  const handleDeclineTarget = (targetId: string) => {
    const normalizedTargetId = normalizeTargetId(targetId)
    const hadSuggestion = Boolean(findSuggestionByTargetId(pendingEdits, normalizedTargetId))
    setPendingEdits((prev) => removeSuggestionByTargetId(prev, normalizedTargetId))
    if (hadSuggestion) {
      queueResumeGamification(GAMIFICATION_EVENT_TYPES.RESUME_DECLINE_TAILOR_EDIT)
    }
    setActiveTargetId((current) => (current === normalizedTargetId ? null : current))
  }

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
          <h1 className={styles.title}>Resume Editor</h1>
          <p className={styles.subtitle}>
            Edit your resume inline and match your skills to the job description
          </p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.modeToggle}>
            <button
              className={cn(styles.modeBtn, !isPreviewMode && styles.modeBtnActive)}
              onClick={() => setIsPreviewMode(false)}
            >
              Edit
            </button>
            <button
              className={cn(styles.modeBtn, isPreviewMode && styles.modeBtnActive)}
              onClick={() => setIsPreviewMode(true)}
            >
              Preview
            </button>
          </div>
          <input
            ref={pdfInputRef}
            type="file"
            accept=".pdf,application/pdf"
            style={{ display: 'none' }}
            onChange={handlePdfImport}
          />
          <Button
            variant='secondary'
            size='sm'
            onClick={() => pdfInputRef.current?.click()}
            loading={isUploadLoading}
          >
            <FileUp size={14} /> {uploadPhase === 'uploading' || uploadPhase === 'parsing' ? 'Processing...' : 'Upload Resume'}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleExportPDF}>
            <Download size={14} />
            Export PDF
          </Button>
          <Button variant="secondary" size="sm" onClick={handleSaveResume} loading={isPersistenceLoading}>
            Save Resume
          </Button>
          <Button variant="primary" size="sm" onClick={handleAutoTailor} loading={isLoading}>
            <Sparkles size={14} />
            Auto-Tailor
          </Button>
        </div>
      </div>

      <div className={styles.layout}>
        <aside className={styles.leftPanel}>
          <div className={styles.card}>
            <p className={styles.cardTitle}>Target Job Description</p>
            <p className={styles.cardSubtitle}>
              Paste the job description to get tailored suggestions.
            </p>
            <textarea
              className={styles.jobTextarea}
              placeholder="e.g. We are looking for a Senior Frontend Engineer with deep React expertise..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
          </div>

          <div className={styles.card}>
            <p className={styles.cardTitle}>Your Skills</p>
            <p className={styles.cardSubtitle}>Manage the skills highlighted on your resume.</p>
            <div className={styles.skillSearchWrapper}>
              <Search size={13} className={styles.skillSearchIcon} />
              <input
                className={styles.skillInput}
                placeholder="Add a skill (press Enter)..."
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={handleSkillKeyDown}
              />
            </div>
            <div className={styles.skillChips}>
              {resumeContent.skills.map((skill) => (
                <span key={skill.id} className={styles.skillChip}>
                  {skill.text}
                  <button
                    className={styles.skillChipRemove}
                    onClick={() => setResumeContent((prev) => removeSkill(prev, skill.id))}
                    aria-label={`Remove ${skill.text}`}
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </aside>

        <div className={styles.resumePanel}>
          {pageError && (
            <div className={styles.errorBanner} role="alert">
              {pageError}
            </div>
          )}
          <div className={styles.resumeWorkspace}>
            <div ref={resumeRef} className={styles.resumeDocument}>
              <div className={styles.resumeHeader}>
                <h2
                  className={cn(styles.resumeName, activeTargetId === ID_GENERATORS.profileName() && styles.targetActive)}
                  data-target-id={ID_GENERATORS.profileName()}
                  contentEditable={editable}
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    handleUpdateProfileField('name', readEditableText(e.currentTarget))
                  }}
                >
                  {resumeContent.name.text}
                </h2>
                <p
                  className={cn(styles.resumeContact, activeTargetId === ID_GENERATORS.profileContact() && styles.targetActive)}
                  data-target-id={ID_GENERATORS.profileContact()}
                  contentEditable={editable}
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    handleUpdateProfileField('contact', readEditableText(e.currentTarget))
                  }}
                >
                  {resumeContent.contact.text}
                </p>
              </div>

              <div className={styles.resumeSection}>
                <h3 className={styles.sectionHeading}>Summary</h3>
                <p
                  className={cn(styles.resumeText, activeTargetId === ID_GENERATORS.summary() && styles.targetActive)}
                  data-target-id={ID_GENERATORS.summary()}
                  contentEditable={editable}
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    handleUpdateSummary(readEditableText(e.currentTarget))
                  }}
                >
                  {resumeContent.summary.text}
                </p>
              </div>

              <div className={styles.resumeSection}>
                <h3 className={styles.sectionHeading}>Experience</h3>
                {resumeContent.experience.map((job) => (
                  <div key={job.id} className={styles.resumeEntry}>
                    <div className={styles.entryHeader}>
                      <div className={styles.entryTitleWrapper}>
                        <span
                          className={cn(
                            styles.entryTitle,
                            activeTargetId === ID_GENERATORS.experienceField(job.id, 'title') && styles.targetActive
                          )}
                          data-target-id={ID_GENERATORS.experienceField(job.id, 'title')}
                          contentEditable={editable}
                          suppressContentEditableWarning
                          onBlur={(e) => {
                            handleUpdateExperienceField(job.id, 'title', readEditableText(e.currentTarget))
                          }}
                        >
                          {job.title.text}
                        </span>
                        <button
                          className={cn(styles.entryRemoveBtn, !editable && styles.btnHidden)}
                          onClick={() => removeExperience(job.id)}
                          aria-label="Remove entry"
                        >
                          <X size={12} />
                        </button>
                      </div>
                      <span
                        className={cn(
                          styles.entryPeriod,
                          activeTargetId === ID_GENERATORS.experienceField(job.id, 'period') && styles.targetActive
                        )}
                        data-target-id={ID_GENERATORS.experienceField(job.id, 'period')}
                        contentEditable={editable}
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          handleUpdateExperienceField(job.id, 'period', readEditableText(e.currentTarget))
                        }}
                      >
                        {job.period.text}
                      </span>
                    </div>
                    <span
                      className={cn(
                        styles.entryCompany,
                        activeTargetId === ID_GENERATORS.experienceField(job.id, 'company') && styles.targetActive
                      )}
                      data-target-id={ID_GENERATORS.experienceField(job.id, 'company')}
                      contentEditable={editable}
                      suppressContentEditableWarning
                      onBlur={(e) => {
                        handleUpdateExperienceField(job.id, 'company', readEditableText(e.currentTarget))
                      }}
                    >
                      {job.company.text}
                    </span>
                    <ul className={styles.entryBullets}>
                      {job.bullets.map((bullet) => (
                        <li key={bullet.id} className={styles.bulletItem}>
                          <span
                            className={cn(activeTargetId === bullet.id && styles.targetActive, styles.bulletText)}
                            data-target-id={bullet.id}
                            contentEditable={editable}
                            suppressContentEditableWarning
                            onBlur={(e) => {
                              handleUpdateBullet(job.id, bullet.id, readEditableText(e.currentTarget))
                            }}
                          >
                            {bullet.text}
                          </span>
                          <button
                            className={cn(styles.bulletRemoveBtn, !editable && styles.btnHidden)}
                            onClick={() => setResumeContent((prev) => removeBullet(prev, job.id, bullet.id))}
                            aria-label="Remove bullet"
                          >
                            <X size={10} />
                          </button>
                        </li>
                      ))}
                      {editable && (
                        <button className={styles.addBulletBtn} onClick={() => addBullet(job.id)}>
                          <Plus size={11} /> Add bullet
                        </button>
                      )}
                    </ul>
                  </div>
                ))}
                {editable && (
                  <button className={styles.addEntryBtn} onClick={addExperience}>
                    <Plus size={13} /> Add experience
                  </button>
                )}
              </div>

              <div className={styles.resumeSection}>
                <h3 className={styles.sectionHeading}>Education</h3>
                {resumeContent.education.map((edu) => (
                  <div key={edu.id} className={styles.resumeEntry}>
                    <div className={styles.entryHeader}>
                      <div className={styles.entryTitleWrapper}>
                        <span
                          className={cn(
                            styles.entryTitle,
                            activeTargetId === ID_GENERATORS.educationField(edu.id, 'degree') && styles.targetActive
                          )}
                          data-target-id={ID_GENERATORS.educationField(edu.id, 'degree')}
                          contentEditable={editable}
                          suppressContentEditableWarning
                          onBlur={(e) => {
                            handleUpdateEducationField(edu.id, 'degree', readEditableText(e.currentTarget))
                          }}
                        >
                          {edu.degree.text}
                        </span>
                        <button
                          className={cn(styles.entryRemoveBtn, !editable && styles.btnHidden)}
                          onClick={() => removeEducation(edu.id)}
                          aria-label="Remove entry"
                        >
                          <X size={12} />
                        </button>
                      </div>
                      <span
                        className={cn(
                          styles.entryPeriod,
                          activeTargetId === ID_GENERATORS.educationField(edu.id, 'period') && styles.targetActive
                        )}
                        data-target-id={ID_GENERATORS.educationField(edu.id, 'period')}
                        contentEditable={editable}
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          handleUpdateEducationField(edu.id, 'period', readEditableText(e.currentTarget))
                        }}
                      >
                        {edu.period.text}
                      </span>
                    </div>
                    <span
                      className={cn(
                        styles.entryCompany,
                        activeTargetId === ID_GENERATORS.educationField(edu.id, 'school') && styles.targetActive
                      )}
                      data-target-id={ID_GENERATORS.educationField(edu.id, 'school')}
                      contentEditable={editable}
                      suppressContentEditableWarning
                      onBlur={(e) => {
                        handleUpdateEducationField(edu.id, 'school', readEditableText(e.currentTarget))
                      }}
                    >
                      {edu.school.text}
                    </span>
                  </div>
                ))}
                {editable && (
                  <button className={styles.addEntryBtn} onClick={addEducation}>
                    <Plus size={13} /> Add education
                  </button>
                )}
              </div>
            </div>

            <ResumeSuggestionsPanel
              suggestions={suggestionItems}
              panelState={suggestionPanelState}
              activeTargetId={activeTargetId}
              onActivateTarget={setActiveTargetId}
              onRevealTarget={handleRevealTarget}
              onAcceptTarget={handleAcceptTarget}
              onDeclineTarget={handleDeclineTarget}
            />
          </div>
        </div>
      </div>
    </div>
  )
}