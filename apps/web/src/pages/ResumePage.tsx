import { useState, useRef, KeyboardEvent } from 'react'
import html2pdf from 'html2pdf.js'
import { Download, Sparkles, Search, X, Plus, FileUp } from 'lucide-react'
import { Button } from '@/components/ui'
import { useResumeTailor } from '@/hooks/useResumeTailor'
import type { ResumeTailorEdit, ResumeTailorRequest, ResumeTailorResumeContent } from '@/types'
import { cn } from '@/utils/cn'
import styles from './ResumePage.module.css'

interface ExperienceEntry {
  id: string
  title: string
  company: string
  period: string
  bullets: ResumeTextItem[]
}

interface EducationEntry {
  id: string
  degree: string
  school: string
  period: string
}

interface ResumeTextItem {
  id: string
  text: string
}

const MOCK_RESUME = {
  name: 'Jane Doe',
  contact: 'San Francisco, CA • jane@example.com • linkedin.com/in/janedoe',
  summary:
    'Senior Frontend Engineer with 5+ years of experience building scalable web applications. Passionate about performance, accessibility, and creating pixel-perfect user interfaces using modern React and TypeScript.',
}

const MOCK_EXPERIENCE: ExperienceEntry[] = [
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

const MOCK_EDUCATION: EducationEntry[] = [
  { id: 'ed1', degree: 'B.S. Computer Science', school: 'UC San Diego', period: '2014 – 2018' },
]

// Stable ID generators (single source of truth)
const ID_GENERATORS = {
  profileName: () => 'profile_name',
  profileContact: () => 'profile_contact',
  summary: () => 'summary',
  experienceField: (entryId: string, field: 'title' | 'company' | 'period') =>
    `experience_${entryId}_${field}`,
  experienceBullet: (entryId: string, bulletId: string) => `experience_${entryId}_bullet_${bulletId}`,
  educationField: (entryId: string, field: 'degree' | 'school' | 'period') =>
    `education_${entryId}_${field}`,
  skillItem: (skillId: string) => `skill_${skillId}`,
}

const createId = () => crypto.randomUUID().replace(/-/g, '')

// Inline suggestion renderer: minimal diff block with accept/decline
interface SuggestionDiffProps {
  edit: ResumeTailorEdit
  currentValue: string | null
  onAccept: () => void
  onDecline: () => void
  variant?: 'compact' | 'stacked'
}

const SuggestionDiff = ({ edit, currentValue, onAccept, onDecline, variant = 'compact' }: SuggestionDiffProps) => {
  if (variant === 'stacked') {
    return (
      <div style={{ borderLeft: '3px solid #4f46e5', paddingLeft: '0.75rem', marginTop: '0.5rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#666', marginBottom: '0.5rem' }}>
          AI Suggestion:
        </div>
        <div
          style={{
            display: 'grid',
            gap: '0.75rem',
            marginBottom: '0.75rem',
            fontSize: '0.875rem',
          }}
        >
          <div style={{ padding: '0.75rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
            <strong style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem', color: '#999' }}>
              Current
            </strong>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {currentValue ?? '(not found)'}
            </p>
          </div>
          <div style={{ padding: '0.75rem', backgroundColor: '#f0f9ff', borderRadius: '4px' }}>
            <strong style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem', color: '#166534' }}>
              Proposed
            </strong>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {edit.replacement}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={onAccept}
            style={{
              padding: '0.375rem 0.75rem',
              fontSize: '0.75rem',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Accept
          </button>
          <button
            onClick={onDecline}
            style={{
              padding: '0.375rem 0.75rem',
              fontSize: '0.75rem',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Decline
          </button>
        </div>
      </div>
    )
  }

  // compact variant for bullets: single line current → proposed
  return (
    <div style={{ borderLeft: '3px solid #4f46e5', paddingLeft: '0.75rem', marginTop: '0.25rem', fontSize: '0.8125rem' }}>
      <div style={{ marginBottom: '0.25rem', color: '#666' }}>
        <span style={{ textDecoration: 'line-through', color: '#7f1d1d' }}>
          {currentValue ?? 'Current value unavailable (target may have been removed)'}
        </span>
        <span style={{ margin: '0 0.25rem' }}>→</span>
        <span style={{ color: '#166534' }}>{edit.replacement}</span>
      </div>
      <div style={{ display: 'flex', gap: '0.375rem' }}>
        <button
          onClick={onAccept}
          style={{
            padding: '0.25rem 0.5rem',
            fontSize: '0.7rem',
            backgroundColor: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
          }}
        >
          Accept
        </button>
        <button
          onClick={onDecline}
          style={{
            padding: '0.25rem 0.5rem',
            fontSize: '0.7rem',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
          }}
        >
          Decline
        </button>
      </div>
    </div>
  )
}

// Get suggestion for a specific targetId
const getEditForTarget = (targetId: string, edits: ResumeTailorEdit[]): ResumeTailorEdit | null => {
  return edits.find((e) => e.targetId === targetId) ?? null
}

export default function ResumePage() {
  const resumeRef = useRef<HTMLDivElement>(null)
  const [resumeName, setResumeName] = useState(MOCK_RESUME.name)
  const [resumeContact, setResumeContact] = useState(MOCK_RESUME.contact)
  const [resumeSummary, setResumeSummary] = useState(MOCK_RESUME.summary)
  const [jobDescription, setJobDescription] = useState('')
  const [skills, setSkills] = useState<ResumeTextItem[]>([
    { id: 's1', text: 'React' },
    { id: 's2', text: 'TypeScript' },
    { id: 's3', text: 'Node.js' },
    { id: 's4', text: 'GraphQL' },
    { id: 's5', text: 'Tailwind CSS' },
  ])
  const [skillInput, setSkillInput] = useState('')
  const [experience, setExperience] = useState<ExperienceEntry[]>(MOCK_EXPERIENCE)
  const [education, setEducation] = useState<EducationEntry[]>(MOCK_EDUCATION)
  const [pendingEdits, setPendingEdits] = useState<ResumeTailorEdit[]>([])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const { runTailor, isLoading, error: tailorError, clearError } = useResumeTailor()

  const pdfInputRef = useRef<HTMLInputElement>(null)

  function handlePdfImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // TODO(resume-import): wire real PDF parsing and field extraction in a follow-up PR.
    setSubmitError(`PDF import for \"${file.name}\" is not implemented yet. Please edit fields manually.`)
    e.currentTarget.value = ''
  }

  function updateExperienceField(id: string, field: 'title' | 'company' | 'period', value: string) {
    setExperience((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)))
  }

  function updateEducationField(id: string, field: 'degree' | 'school' | 'period', value: string) {
    setEducation((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)))
  }

  function updateBullet(expId: string, bulletId: string, value: string) {
    setExperience((prev) =>
      prev.map((e) =>
        e.id === expId
          ? {
              ...e,
              bullets: e.bullets.map((bullet) =>
                bullet.id === bulletId ? { ...bullet, text: value } : bullet
              ),
            }
          : e
      )
    )
  }

  function addExperience() {
    setExperience((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        title: 'Job Title',
        company: 'Company Name',
        period: 'Year – Year',
        bullets: [{ id: `${createId()}_b1`, text: 'Describe your responsibilities here.' }],
      },
    ])
  }

  function removeExperience(id: string) {
    setExperience((prev) => prev.filter((e) => e.id !== id))
  }

  function addBullet(expId: string) {
    setExperience((prev) =>
      prev.map((e) =>
        e.id === expId
          ? {
              ...e,
              bullets: [...e.bullets, { id: createId(), text: 'New bullet point.' }],
            }
          : e
      )
    )
  }

  function removeBullet(expId: string, bulletId: string) {
    setExperience((prev) =>
      prev.map((e) =>
        e.id === expId ? { ...e, bullets: e.bullets.filter((bullet) => bullet.id !== bulletId) } : e
      )
    )
  }

  function addEducation() {
    setEducation((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        degree: 'Degree / Certification',
        school: 'Institution Name',
        period: 'Year – Year',
      },
    ])
  }

  function removeEducation(id: string) {
    setEducation((prev) => prev.filter((e) => e.id !== id))
  }

  function handleSkillKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      const trimmed = skillInput.trim()
      if (trimmed && !skills.some((skill) => skill.text.toLowerCase() === trimmed.toLowerCase())) {
        setSkills((prev) => [...prev, { id: createId(), text: trimmed }])
      }
      setSkillInput('')
    }
  }

  function removeSkill(skillId: string) {
    setSkills((prev) => prev.filter((skill) => skill.id !== skillId))
  }

  function getCurrentValueForTarget(targetId: string): string | null {
    if (targetId === ID_GENERATORS.profileName()) return resumeName
    if (targetId === ID_GENERATORS.profileContact()) return resumeContact
    if (targetId === ID_GENERATORS.summary()) return resumeSummary

    const expFieldMatch = targetId.match(/^experience_(.+?)_(title|company|period)$/)
    if (expFieldMatch) {
      const [, entryId, field] = expFieldMatch
      const entry = experience.find((e) => e.id === entryId)
      return entry ? entry[field as 'title' | 'company' | 'period'] : null
    }

    const expBulletMatch = targetId.match(/^experience_(.+?)_bullet_(.+)$/)
    if (expBulletMatch) {
      const [, entryId, bulletId] = expBulletMatch
      const entry = experience.find((e) => e.id === entryId)
      return entry?.bullets.find((bullet) => bullet.id === bulletId)?.text ?? null
    }

    const eduFieldMatch = targetId.match(/^education_(.+?)_(degree|school|period)$/)
    if (eduFieldMatch) {
      const [, entryId, field] = eduFieldMatch
      const entry = education.find((e) => e.id === entryId)
      return entry ? entry[field as 'degree' | 'school' | 'period'] : null
    }

    const skillMatch = targetId.match(/^skill_(.+)$/)
    if (skillMatch) {
      const skillId = skillMatch[1]
      return skills.find((skill) => skill.id === skillId)?.text ?? null
    }

    const legacyMatch = targetId.match(/^exp_(\d+)_bullet_(\d+)$/)
    if (legacyMatch) {
      const entry = experience[Number(legacyMatch[1]) - 1]
      return entry?.bullets[Number(legacyMatch[2]) - 1]?.text ?? null
    }

    return null
  }

  function applyEdit(edit: ResumeTailorEdit): boolean {
    const { targetId, operation, replacement } = edit

    if (targetId === ID_GENERATORS.profileName()) {
      if (operation === 'replace') setResumeName(replacement)
      else if (operation === 'insert') setResumeName((prev) => `${prev} ${replacement}`.trim())
      else setResumeName('')
      return true
    }

    if (targetId === ID_GENERATORS.profileContact()) {
      if (operation === 'replace') setResumeContact(replacement)
      else if (operation === 'insert') setResumeContact((prev) => `${prev} ${replacement}`.trim())
      else setResumeContact('')
      return true
    }

    if (targetId === ID_GENERATORS.summary()) {
      if (operation === 'replace') setResumeSummary(replacement)
      else if (operation === 'insert') setResumeSummary((prev) => `${prev}\n${replacement}`.trim())
      else setResumeSummary('')
      return true
    }

    const expFieldMatch = targetId.match(/^experience_(.+?)_(title|company|period)$/)
    if (expFieldMatch) {
      const [, entryId, field] = expFieldMatch
      const exists = experience.some((e) => e.id === entryId)
      if (!exists) return false
      const fieldKey = field as 'title' | 'company' | 'period'
      if (operation === 'replace') updateExperienceField(entryId, fieldKey, replacement)
      else if (operation === 'insert') {
        const current = getCurrentValueForTarget(targetId)
        updateExperienceField(entryId, fieldKey, `${current ?? ''} ${replacement}`.trim())
      } else updateExperienceField(entryId, fieldKey, '')
      return true
    }

    const expBulletMatch = targetId.match(/^experience_(.+?)_bullet_(.+)$/)
    if (expBulletMatch) {
      const [, entryId, bulletId] = expBulletMatch
      const entry = experience.find((e) => e.id === entryId)
      if (!entry) return false
      if (operation === 'replace') {
        updateBullet(entryId, bulletId, replacement)
      } else if (operation === 'insert') {
        setExperience((prev) =>
          prev.map((e) =>
            e.id === entryId
              ? {
                  ...e,
                  bullets: (() => {
                    const idx = e.bullets.findIndex((bullet) => bullet.id === bulletId)
                    if (idx === -1) return e.bullets
                    const next = [...e.bullets]
                    next.splice(idx + 1, 0, { id: createId(), text: replacement })
                    return next
                  })(),
                }
              : e
          )
        )
      } else {
        setExperience((prev) =>
          prev.map((e) =>
            e.id === entryId
              ? { ...e, bullets: e.bullets.filter((bullet) => bullet.id !== bulletId) }
              : e
          )
        )
      }
      return true
    }

    const eduFieldMatch = targetId.match(/^education_(.+?)_(degree|school|period)$/)
    if (eduFieldMatch) {
      const [, entryId, field] = eduFieldMatch
      const exists = education.some((e) => e.id === entryId)
      if (!exists) return false
      const fieldKey = field as 'degree' | 'school' | 'period'
      if (operation === 'replace') updateEducationField(entryId, fieldKey, replacement)
      else if (operation === 'insert') {
        const current = getCurrentValueForTarget(targetId)
        updateEducationField(entryId, fieldKey, `${current ?? ''} ${replacement}`.trim())
      } else updateEducationField(entryId, fieldKey, '')
      return true
    }

    const skillMatch = targetId.match(/^skill_(.+)$/)
    if (skillMatch) {
      const skillId = skillMatch[1]
      const idx = skills.findIndex((skill) => skill.id === skillId)
      if (idx === -1) return false
      if (operation === 'replace') {
        setSkills((prev) =>
          prev.map((skill) => (skill.id === skillId ? { ...skill, text: replacement } : skill))
        )
      } else if (operation === 'insert') {
        setSkills((prev) => [
          ...prev.slice(0, idx + 1),
          { id: createId(), text: replacement },
          ...prev.slice(idx + 1),
        ])
      } else {
        setSkills((prev) => prev.filter((skill) => skill.id !== skillId))
      }
      return true
    }

    return false
  }

  function acceptEdit(index: number) {
    const edit = pendingEdits[index]
    if (edit && applyEdit(edit)) {
      // suggestion applied
    }
    setPendingEdits((prev) => prev.filter((_, i) => i !== index))
  }

  function declineEdit(index: number) {
    setPendingEdits((prev) => prev.filter((_, i) => i !== index))
  }

  const getPendingEditIndex = (targetId: string) =>
    pendingEdits.findIndex((edit) => edit.targetId === targetId)

  const handleAcceptEditByTargetId = (targetId: string) => {
    const idx = getPendingEditIndex(targetId)
    if (idx !== -1) acceptEdit(idx)
  }

  const handleDeclineEditByTargetId = (targetId: string) => {
    const idx = getPendingEditIndex(targetId)
    if (idx !== -1) declineEdit(idx)
  }

  function buildResumeContent(): ResumeTailorResumeContent {
    return {
      name: { id: ID_GENERATORS.profileName(), text: resumeName },
      contact: { id: ID_GENERATORS.profileContact(), text: resumeContact },
      summary: { id: ID_GENERATORS.summary(), text: resumeSummary },
      experience: experience.map((entry) => ({
        id: entry.id,
        title: { id: ID_GENERATORS.experienceField(entry.id, 'title'), text: entry.title },
        company: { id: ID_GENERATORS.experienceField(entry.id, 'company'), text: entry.company },
        period: { id: ID_GENERATORS.experienceField(entry.id, 'period'), text: entry.period },
        bullets: entry.bullets.map((bullet) => ({
          id: ID_GENERATORS.experienceBullet(entry.id, bullet.id),
          text: bullet.text,
        })),
      })),
      education: education.map((entry) => ({
        id: entry.id,
        degree: { id: ID_GENERATORS.educationField(entry.id, 'degree'), text: entry.degree },
        school: { id: ID_GENERATORS.educationField(entry.id, 'school'), text: entry.school },
        period: { id: ID_GENERATORS.educationField(entry.id, 'period'), text: entry.period },
      })),
      skills: skills.map((skill) => ({
        id: ID_GENERATORS.skillItem(skill.id),
        text: skill.text,
      })),
    }
  }

  async function handleAutoTailor() {
    clearError()
    setSubmitError(null)

    if (jobDescription.trim().length < 200) {
      setSubmitError('Please paste a longer job description (minimum 200 characters).')
      return
    }

    const payload: ResumeTailorRequest = {
      jobDescription,
      resumeContent: buildResumeContent(),
      mode: 'delta_only',
    }

    try {
      const result = await runTailor(payload)
      setPendingEdits(result.edits ?? [])
    } catch {
      // error already set by hook
    }
  }

  async function handleExportPDF() {
    if (!resumeRef.current) return
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
  }

  const editable = !isPreviewMode
  const mappedSummaryTargetId = ID_GENERATORS.summary()
  const mappedBulletTargetIds = new Set(
    experience.flatMap((job) =>
      job.bullets.map((bullet) => ID_GENERATORS.experienceBullet(job.id, bullet.id))
    )
  )
  const mappedSkillTargetIds = new Set(skills.map((skill) => ID_GENERATORS.skillItem(skill.id)))
  const mappedTargetIds = new Set<string>([
    mappedSummaryTargetId,
    ...Array.from(mappedBulletTargetIds),
    ...Array.from(mappedSkillTargetIds),
  ])
  const unmappedEdits = pendingEdits.filter((edit) => !mappedTargetIds.has(edit.targetId))

  return (
    <div className={styles.page}>
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
          <input ref={pdfInputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handlePdfImport} />
          <Button variant='secondary' size='sm' onClick={() => pdfInputRef.current?.click()}>
            <FileUp size={14} /> Import PDF
          </Button>
          <Button variant="secondary" size="sm" onClick={handleExportPDF}>
            <Download size={14} />
            Export PDF
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
              {skills.map((skill) => (
                <span key={skill.id} className={styles.skillChip}>
                  {skill.text}
                  <button
                    className={styles.skillChipRemove}
                    onClick={() => removeSkill(skill.id)}
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
          {(submitError || tailorError) && (
            <div className={styles.errorBanner} role="alert">
              {submitError ?? tailorError}
            </div>
          )}



          <div ref={resumeRef} className={styles.resumeDocument}>
            <div className={styles.resumeHeader}>
              <h2
                className={styles.resumeName}
                contentEditable={editable}
                suppressContentEditableWarning
                onBlur={(e) => setResumeName(e.currentTarget.textContent?.trim() || '')}
              >
                {resumeName}
              </h2>
              <p
                className={styles.resumeContact}
                contentEditable={editable}
                suppressContentEditableWarning
                onBlur={(e) => setResumeContact(e.currentTarget.textContent?.trim() || '')}
              >
                {resumeContact}
              </p>
            </div>

            <div className={styles.resumeSection}>
              <h3 className={styles.sectionHeading}>Summary</h3>
              <p
                className={styles.resumeText}
                contentEditable={editable}
                suppressContentEditableWarning
                onBlur={(e) => setResumeSummary(e.currentTarget.textContent?.trim() || '')}
              >
                {resumeSummary}
              </p>
              {(() => {
                const summaryEdit = getEditForTarget(mappedSummaryTargetId, pendingEdits)
                if (summaryEdit) {
                  return (
                    <SuggestionDiff
                      edit={summaryEdit}
                      currentValue={resumeSummary}
                      onAccept={() => handleAcceptEditByTargetId(summaryEdit.targetId)}
                      onDecline={() => handleDeclineEditByTargetId(summaryEdit.targetId)}
                      variant="stacked"
                    />
                  )
                }
                return null
              })()}
            </div>

            <div className={styles.resumeSection}>
              <h3 className={styles.sectionHeading}>Experience</h3>
              {experience.map((job) => (
                <div key={job.id} className={styles.resumeEntry}>
                  <div className={styles.entryHeader}>
                    <div className={styles.entryTitleWrapper}>
                      <span
                        className={styles.entryTitle}
                        contentEditable={editable}
                        suppressContentEditableWarning
                        onBlur={(e) => updateExperienceField(job.id, 'title', e.currentTarget.textContent?.trim() || '')}
                      >
                        {job.title}
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
                      className={styles.entryPeriod}
                      contentEditable={editable}
                      suppressContentEditableWarning
                      onBlur={(e) => updateExperienceField(job.id, 'period', e.currentTarget.textContent?.trim() || '')}
                    >
                      {job.period}
                    </span>
                  </div>
                  <span
                    className={styles.entryCompany}
                    contentEditable={editable}
                    suppressContentEditableWarning
                    onBlur={(e) => updateExperienceField(job.id, 'company', e.currentTarget.textContent?.trim() || '')}
                  >
                    {job.company}
                  </span>
                  <ul className={styles.entryBullets}>
                    {job.bullets.map((bullet) => {
                      const bulletTargetId = ID_GENERATORS.experienceBullet(job.id, bullet.id)
                      const bulletEdit = getEditForTarget(bulletTargetId, pendingEdits)
                      return (
                        <li key={bullet.id} className={styles.bulletItem}>
                          <span
                            contentEditable={editable}
                            suppressContentEditableWarning
                            onBlur={(e) =>
                              updateBullet(job.id, bullet.id, e.currentTarget.textContent?.trim() || '')
                            }
                          >
                            {bullet.text}
                          </span>
                          <button
                            className={cn(styles.bulletRemoveBtn, !editable && styles.btnHidden)}
                            onClick={() => removeBullet(job.id, bullet.id)}
                            aria-label="Remove bullet"
                          >
                            <X size={10} />
                          </button>
                          {bulletEdit && (
                            <SuggestionDiff
                              edit={bulletEdit}
                              currentValue={bullet.text}
                              onAccept={() => handleAcceptEditByTargetId(bulletEdit.targetId)}
                              onDecline={() => handleDeclineEditByTargetId(bulletEdit.targetId)}
                              variant="compact"
                            />
                          )}
                        </li>
                      )
                    })}
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
              {education.map((edu) => (
                <div key={edu.id} className={styles.resumeEntry}>
                  <div className={styles.entryHeader}>
                    <div className={styles.entryTitleWrapper}>
                      <span
                        className={styles.entryTitle}
                        contentEditable={editable}
                        suppressContentEditableWarning
                        onBlur={(e) => updateEducationField(edu.id, 'degree', e.currentTarget.textContent?.trim() || '')}
                      >
                        {edu.degree}
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
                      className={styles.entryPeriod}
                      contentEditable={editable}
                      suppressContentEditableWarning
                      onBlur={(e) => updateEducationField(edu.id, 'period', e.currentTarget.textContent?.trim() || '')}
                    >
                      {edu.period}
                    </span>
                  </div>
                  <span
                    className={styles.entryCompany}
                    contentEditable={editable}
                    suppressContentEditableWarning
                    onBlur={(e) => updateEducationField(edu.id, 'school', e.currentTarget.textContent?.trim() || '')}
                  >
                    {edu.school}
                  </span>
                </div>
              ))}
              {editable && (
                <button className={styles.addEntryBtn} onClick={addEducation}>
                  <Plus size={13} /> Add education
                </button>
              )}
            </div>

            {(() => {
              const skillEdits = pendingEdits.filter(
                (e) => e.section === 'skills' && mappedSkillTargetIds.has(e.targetId)
              )
              if (skillEdits.length > 0) {
                return (
                  <div className={styles.resumeSection}>
                    <h3 className={styles.sectionHeading}>Suggested Skills</h3>
                    {skillEdits.map((edit) => (
                      <SuggestionDiff
                        key={edit.targetId}
                        edit={edit}
                        currentValue={skills.find((s) => ID_GENERATORS.skillItem(s.id) === edit.targetId)?.text ?? null}
                        onAccept={() => handleAcceptEditByTargetId(edit.targetId)}
                        onDecline={() => handleDeclineEditByTargetId(edit.targetId)}
                        variant="stacked"
                      />
                    ))}
                  </div>
                )
              }
              return null
            })()}

            {unmappedEdits.length > 0 && (
              <div className={styles.resumeSection}>
                <h3 className={styles.sectionHeading}>Unmapped Suggestions</h3>
                {unmappedEdits.map((edit) => (
                  <SuggestionDiff
                    key={edit.targetId}
                    edit={edit}
                    currentValue={getCurrentValueForTarget(edit.targetId)}
                    onAccept={() => handleAcceptEditByTargetId(edit.targetId)}
                    onDecline={() => handleDeclineEditByTargetId(edit.targetId)}
                    variant="stacked"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
