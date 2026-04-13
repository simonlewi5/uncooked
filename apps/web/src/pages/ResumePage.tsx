import { useState, useEffect, useRef, KeyboardEvent, useCallback } from 'react'
import html2pdf from 'html2pdf.js'
import { Download, Sparkles, Search, X, Plus, FileUp } from 'lucide-react'
import { Button } from '@/components/ui'
import { useResumeTailor } from '@/hooks/useResumeTailor'
import { useResumeUploadAndParse } from '@/hooks/useResumeUploadAndParse'
import { useResumePersistence } from '@/hooks/useResumePersistence'
import { useAuth } from '@/contexts/AuthContext'
import type { ResumeDocument, ResumeTailorEdit, ResumeTailorRequest } from '@/types'
import { cn } from '@/utils/cn'
import styles from './ResumePage.module.css'

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

// Stable ID generators (single source of truth)
const ID_GENERATORS = {
  profileName: () => 'profile/name',
  profileContact: () => 'profile/contact',
  summary: () => 'profile/summary',
  experienceField: (entryId: string, field: 'title' | 'company' | 'period') =>
    `experience/${entryId}/${field}`,
  experienceBullet: (entryId: string, bulletId: string) => `experience/${entryId}/bullets/${bulletId}`,
  educationField: (entryId: string, field: 'degree' | 'school' | 'period') =>
    `education/${entryId}/${field}`,
  skillItem: (skillId: string) => `skills/${skillId}`,
}

const createId = () => crypto.randomUUID().replace(/-/g, '')

const normalizeTargetId = (id: string): string => {
  return id.trim()
}

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
  return edits.find((e) => normalizeTargetId(e.targetId) === targetId) ?? null
}

export default function ResumePage() {
  const { user } = useAuth()
  const resumeRef = useRef<HTMLDivElement>(null)
  const [resumeContent, setResumeContent] = useState<ResumeDocument>(toInitialResumeContent)
  const [jobDescription, setJobDescription] = useState('')
  const [skillInput, setSkillInput] = useState('')
  const [pendingEdits, setPendingEdits] = useState<ResumeTailorEdit[]>([])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
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

  const toCanonicalId = useCallback((id: string, fallback: string): string => {
    const normalized = normalizeTargetId(id)
    return normalized || fallback
  }, [])

  const hydrateFromStructuredContent = useCallback(
    (content: ResumeDocument) => {
      setResumeContent({
        name: {
          id: toCanonicalId(content.name.id, ID_GENERATORS.profileName()),
          text: content.name.text,
        },
        contact: {
          id: toCanonicalId(content.contact.id, ID_GENERATORS.profileContact()),
          text: content.contact.text,
        },
        summary: {
          id: toCanonicalId(content.summary.id, ID_GENERATORS.summary()),
          text: content.summary.text,
        },
        experience: content.experience.map((entry) => ({
          id: entry.id,
          title: {
            id: toCanonicalId(entry.title.id, ID_GENERATORS.experienceField(entry.id, 'title')),
            text: entry.title.text,
          },
          company: {
            id: toCanonicalId(entry.company.id, ID_GENERATORS.experienceField(entry.id, 'company')),
            text: entry.company.text,
          },
          period: {
            id: toCanonicalId(entry.period.id, ID_GENERATORS.experienceField(entry.id, 'period')),
            text: entry.period.text,
          },
          bullets: entry.bullets.map((bullet, index) => ({
            id: toCanonicalId(bullet.id, ID_GENERATORS.experienceBullet(entry.id, `b${index + 1}`)),
            text: bullet.text,
          })),
        })),
        education: content.education.map((entry) => ({
          id: entry.id,
          degree: {
            id: toCanonicalId(entry.degree.id, ID_GENERATORS.educationField(entry.id, 'degree')),
            text: entry.degree.text,
          },
          school: {
            id: toCanonicalId(entry.school.id, ID_GENERATORS.educationField(entry.id, 'school')),
            text: entry.school.text,
          },
          period: {
            id: toCanonicalId(entry.period.id, ID_GENERATORS.educationField(entry.id, 'period')),
            text: entry.period.text,
          },
        })),
        skills: content.skills.map((skill, index) => ({
          id: toCanonicalId(skill.id, ID_GENERATORS.skillItem(`s${index + 1}`)),
          text: skill.text,
        })),
      })
    },
    [toCanonicalId]
  )

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!user?.id) return
      clearPersistenceError()

      try {
        const existing = await loadPrimaryResume(user.id)
        if (cancelled || !existing?.structuredContent) return
        hydrateFromStructuredContent(existing.structuredContent)
        setActiveResumeId(existing.id)
      } catch {
        // error surfaced through persistenceError
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [user?.id, loadPrimaryResume, clearPersistenceError, hydrateFromStructuredContent])

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
      hydrateFromStructuredContent(saved.structuredContent)
      setActiveResumeId(saved.id)
      setPendingEdits([])
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

  function updateExperienceField(id: string, field: 'title' | 'company' | 'period', value: string) {
    setResumeContent((prev) => ({
      ...prev,
      experience: prev.experience.map((entry) =>
        entry.id === id ? { ...entry, [field]: { ...entry[field], text: value } } : entry
      ),
    }))
  }

  function updateEducationField(id: string, field: 'degree' | 'school' | 'period', value: string) {
    setResumeContent((prev) => ({
      ...prev,
      education: prev.education.map((entry) =>
        entry.id === id ? { ...entry, [field]: { ...entry[field], text: value } } : entry
      ),
    }))
  }

  function updateBullet(expId: string, bulletId: string, value: string) {
    setResumeContent((prev) => ({
      ...prev,
      experience: prev.experience.map((entry) =>
        entry.id === expId
          ? {
              ...entry,
              bullets: entry.bullets.map((bullet) =>
                bullet.id === bulletId ? { ...bullet, text: value } : bullet
              ),
            }
          : entry
      ),
    }))
  }

  function addExperience() {
    const id = crypto.randomUUID()
    setResumeContent((prev) => ({
      ...prev,
      experience: [
        ...prev.experience,
        {
          id,
          title: { id: ID_GENERATORS.experienceField(id, 'title'), text: 'Job Title' },
          company: { id: ID_GENERATORS.experienceField(id, 'company'), text: 'Company Name' },
          period: { id: ID_GENERATORS.experienceField(id, 'period'), text: 'Year – Year' },
          bullets: [
            {
              id: ID_GENERATORS.experienceBullet(id, `b${createId()}`),
              text: 'Describe your responsibilities here.',
            },
          ],
        },
      ],
    }))
  }

  function removeExperience(id: string) {
    setResumeContent((prev) => ({
      ...prev,
      experience: prev.experience.filter((entry) => entry.id !== id),
    }))
  }

  function addBullet(expId: string) {
    setResumeContent((prev) => ({
      ...prev,
      experience: prev.experience.map((entry) =>
        entry.id === expId
          ? {
              ...entry,
              bullets: [
                ...entry.bullets,
                {
                  id: ID_GENERATORS.experienceBullet(expId, `b${createId()}`),
                  text: 'New bullet point.',
                },
              ],
            }
          : entry
      ),
    }))
  }

  function removeBullet(expId: string, bulletId: string) {
    setResumeContent((prev) => ({
      ...prev,
      experience: prev.experience.map((entry) =>
        entry.id === expId
          ? { ...entry, bullets: entry.bullets.filter((bullet) => bullet.id !== bulletId) }
          : entry
      ),
    }))
  }

  function addEducation() {
    const id = crypto.randomUUID()
    setResumeContent((prev) => ({
      ...prev,
      education: [
        ...prev.education,
        {
          id,
          degree: { id: ID_GENERATORS.educationField(id, 'degree'), text: 'Degree / Certification' },
          school: { id: ID_GENERATORS.educationField(id, 'school'), text: 'Institution Name' },
          period: { id: ID_GENERATORS.educationField(id, 'period'), text: 'Year – Year' },
        },
      ],
    }))
  }

  function removeEducation(id: string) {
    setResumeContent((prev) => ({
      ...prev,
      education: prev.education.filter((entry) => entry.id !== id),
    }))
  }

  function handleSkillKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      const trimmed = skillInput.trim()
      if (
        trimmed &&
        !resumeContent.skills.some((skill) => skill.text.toLowerCase() === trimmed.toLowerCase())
      ) {
        setResumeContent((prev) => ({
          ...prev,
          skills: [...prev.skills, { id: ID_GENERATORS.skillItem(`s${createId()}`), text: trimmed }],
        }))
      }
      setSkillInput('')
    }
  }

  function removeSkill(skillId: string) {
    setResumeContent((prev) => ({
      ...prev,
      skills: prev.skills.filter((skill) => skill.id !== skillId),
    }))
  }

  function getCurrentValueForTarget(targetId: string): string | null {
    const normalizedTargetId = normalizeTargetId(targetId)
    if (normalizedTargetId === ID_GENERATORS.profileName()) return resumeContent.name.text
    if (normalizedTargetId === ID_GENERATORS.profileContact()) return resumeContent.contact.text
    if (normalizedTargetId === ID_GENERATORS.summary()) return resumeContent.summary.text

    const expFieldMatch = normalizedTargetId.match(/^experience\/(.+?)\/(title|company|period)$/)
    if (expFieldMatch) {
      const [, entryId, field] = expFieldMatch
      const entry = resumeContent.experience.find((e) => e.id === entryId)
      return entry ? entry[field as 'title' | 'company' | 'period'].text : null
    }

    const expBulletMatch = normalizedTargetId.match(/^experience\/(.+?)\/bullets\/(.+)$/)
    if (expBulletMatch) {
      const [, entryId, bulletId] = expBulletMatch
      const entry = resumeContent.experience.find((e) => e.id === entryId)
      return entry?.bullets.find((bullet) => bullet.id === bulletId)?.text ?? null
    }

    const eduFieldMatch = normalizedTargetId.match(/^education\/(.+?)\/(degree|school|period)$/)
    if (eduFieldMatch) {
      const [, entryId, field] = eduFieldMatch
      const entry = resumeContent.education.find((e) => e.id === entryId)
      return entry ? entry[field as 'degree' | 'school' | 'period'].text : null
    }

    const skillMatch = normalizedTargetId.match(/^skills\/(.+)$/)
    if (skillMatch) {
      const skillId = skillMatch[1]
      return resumeContent.skills.find((skill) => skill.id === skillId)?.text ?? null
    }

    return null
  }

  function applyEdit(edit: ResumeTailorEdit): boolean {
    const { operation, replacement } = edit
    const targetId = normalizeTargetId(edit.targetId)

    if (targetId === ID_GENERATORS.profileName()) {
      if (operation === 'replace') {
        setResumeContent((prev) => ({
          ...prev,
          name: { ...prev.name, text: replacement },
        }))
      } else if (operation === 'insert') {
        setResumeContent((prev) => ({
          ...prev,
          name: { ...prev.name, text: `${prev.name.text} ${replacement}`.trim() },
        }))
      } else {
        setResumeContent((prev) => ({
          ...prev,
          name: { ...prev.name, text: '' },
        }))
      }
      return true
    }

    if (targetId === ID_GENERATORS.profileContact()) {
      if (operation === 'replace') {
        setResumeContent((prev) => ({
          ...prev,
          contact: { ...prev.contact, text: replacement },
        }))
      } else if (operation === 'insert') {
        setResumeContent((prev) => ({
          ...prev,
          contact: { ...prev.contact, text: `${prev.contact.text} ${replacement}`.trim() },
        }))
      } else {
        setResumeContent((prev) => ({
          ...prev,
          contact: { ...prev.contact, text: '' },
        }))
      }
      return true
    }

    if (targetId === ID_GENERATORS.summary()) {
      if (operation === 'replace') {
        setResumeContent((prev) => ({
          ...prev,
          summary: { ...prev.summary, text: replacement },
        }))
      } else if (operation === 'insert') {
        setResumeContent((prev) => ({
          ...prev,
          summary: { ...prev.summary, text: `${prev.summary.text}\n${replacement}`.trim() },
        }))
      } else {
        setResumeContent((prev) => ({
          ...prev,
          summary: { ...prev.summary, text: '' },
        }))
      }
      return true
    }

    const expFieldMatch = targetId.match(/^experience\/(.+?)\/(title|company|period)$/)
    if (expFieldMatch) {
      const [, entryId, field] = expFieldMatch
      const exists = resumeContent.experience.some((e) => e.id === entryId)
      if (!exists) return false
      const fieldKey = field as 'title' | 'company' | 'period'
      if (operation === 'replace') updateExperienceField(entryId, fieldKey, replacement)
      else if (operation === 'insert') {
        const current = getCurrentValueForTarget(targetId)
        updateExperienceField(entryId, fieldKey, `${current ?? ''} ${replacement}`.trim())
      } else updateExperienceField(entryId, fieldKey, '')
      return true
    }

    const expBulletMatch = targetId.match(/^experience\/(.+?)\/bullets\/(.+)$/)
    if (expBulletMatch) {
      const [, entryId, bulletId] = expBulletMatch
      const entry = resumeContent.experience.find((e) => e.id === entryId)
      if (!entry) return false
      if (operation === 'replace') {
        updateBullet(entryId, bulletId, replacement)
      } else if (operation === 'insert') {
        setResumeContent((prev) => ({
          ...prev,
          experience: prev.experience.map((entryItem) =>
            entryItem.id === entryId
              ? {
                  ...entryItem,
                  bullets: (() => {
                    const idx = entryItem.bullets.findIndex((bullet) => bullet.id === bulletId)
                    if (idx === -1) return entryItem.bullets
                    const next = [...entryItem.bullets]
                    next.splice(idx + 1, 0, {
                      id: ID_GENERATORS.experienceBullet(entryId, `b${createId()}`),
                      text: replacement,
                    })
                    return next
                  })(),
                }
              : entryItem
          ),
        }))
      } else {
        setResumeContent((prev) => ({
          ...prev,
          experience: prev.experience.map((entryItem) =>
            entryItem.id === entryId
              ? {
                  ...entryItem,
                  bullets: entryItem.bullets.filter((bullet) => bullet.id !== bulletId),
                }
              : entryItem
          ),
        }))
      }
      return true
    }

    const eduFieldMatch = targetId.match(/^education\/(.+?)\/(degree|school|period)$/)
    if (eduFieldMatch) {
      const [, entryId, field] = eduFieldMatch
      const exists = resumeContent.education.some((e) => e.id === entryId)
      if (!exists) return false
      const fieldKey = field as 'degree' | 'school' | 'period'
      if (operation === 'replace') updateEducationField(entryId, fieldKey, replacement)
      else if (operation === 'insert') {
        const current = getCurrentValueForTarget(targetId)
        updateEducationField(entryId, fieldKey, `${current ?? ''} ${replacement}`.trim())
      } else updateEducationField(entryId, fieldKey, '')
      return true
    }

    const skillMatch = targetId.match(/^skills\/(.+)$/)
    if (skillMatch) {
      const skillId = skillMatch[1]
      const idx = resumeContent.skills.findIndex((skill) => skill.id === skillId)
      if (idx === -1) return false
      if (operation === 'replace') {
        setResumeContent((prev) => ({
          ...prev,
          skills: prev.skills.map((skill) =>
            skill.id === skillId ? { ...skill, text: replacement } : skill
          ),
        }))
      } else if (operation === 'insert') {
        setResumeContent((prev) => ({
          ...prev,
          skills: [
            ...prev.skills.slice(0, idx + 1),
            { id: ID_GENERATORS.skillItem(`s${createId()}`), text: replacement },
            ...prev.skills.slice(idx + 1),
          ],
        }))
      } else {
        setResumeContent((prev) => ({
          ...prev,
          skills: prev.skills.filter((skill) => skill.id !== skillId),
        }))
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
    pendingEdits.findIndex((edit) => normalizeTargetId(edit.targetId) === targetId)

  const handleAcceptEditByTargetId = (targetId: string) => {
    const idx = getPendingEditIndex(targetId)
    if (idx !== -1) acceptEdit(idx)
  }

  const handleDeclineEditByTargetId = (targetId: string) => {
    const idx = getPendingEditIndex(targetId)
    if (idx !== -1) declineEdit(idx)
  }

  function buildResumeContent(): ResumeDocument {
    return {
      name: resumeContent.name,
      contact: resumeContent.contact,
      summary: resumeContent.summary,
      experience: resumeContent.experience.map((entry) => ({
        id: entry.id,
        title: entry.title,
        company: entry.company,
        period: entry.period,
        bullets: entry.bullets.map((bullet) => ({
          id: bullet.id,
          text: bullet.text,
        })),
      })),
      education: resumeContent.education.map((entry) => ({
        id: entry.id,
        degree: entry.degree,
        school: entry.school,
        period: entry.period,
      })),
      skills: resumeContent.skills.map((skill) => ({
        id: skill.id,
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

  async function handleSaveResume() {
    clearPersistenceError()
    setSubmitError(null)

    if (!activeResumeId) {
      setSubmitError('Upload and parse a resume first before saving changes.')
      return
    }

    try {
      await saveResume(activeResumeId, buildResumeContent(), 'edited')
    } catch {
      // error surfaced through persistenceError
    }
  }

  const editable = !isPreviewMode
  const mappedSummaryTargetId = ID_GENERATORS.summary()
  const mappedBulletTargetIds = new Set(
    resumeContent.experience.flatMap((job) => job.bullets.map((bullet) => bullet.id))
  )
  const mappedSkillTargetIds = new Set(resumeContent.skills.map((skill) => skill.id))
  const mappedTargetIds = new Set<string>([
    mappedSummaryTargetId,
    ...Array.from(mappedBulletTargetIds),
    ...Array.from(mappedSkillTargetIds),
  ])
  const unmappedEdits = pendingEdits.filter((edit) => !mappedTargetIds.has(normalizeTargetId(edit.targetId)))

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
          {(submitError || tailorError || uploadError || persistenceError) && (
            <div className={styles.errorBanner} role="alert">
              {submitError ?? uploadError ?? persistenceError ?? tailorError}
            </div>
          )}



          <div ref={resumeRef} className={styles.resumeDocument}>
            <div className={styles.resumeHeader}>
              <h2
                className={styles.resumeName}
                contentEditable={editable}
                suppressContentEditableWarning
                onBlur={(e) => {
                  const value = e.currentTarget?.textContent?.trim() || ''
                  setResumeContent((prev) => ({
                    ...prev,
                    name: { ...prev.name, text: value },
                  }))
                }}
              >
                {resumeContent.name.text}
              </h2>
              <p
                className={styles.resumeContact}
                contentEditable={editable}
                suppressContentEditableWarning
                onBlur={(e) => {
                  const value = e.currentTarget?.textContent?.trim() || ''
                  setResumeContent((prev) => ({
                    ...prev,
                    contact: { ...prev.contact, text: value },
                  }))
                }}
              >
                {resumeContent.contact.text}
              </p>
            </div>

            <div className={styles.resumeSection}>
              <h3 className={styles.sectionHeading}>Summary</h3>
              <p
                className={styles.resumeText}
                contentEditable={editable}
                suppressContentEditableWarning
                onBlur={(e) => {
                  const value = e.currentTarget?.textContent?.trim() || ''
                  setResumeContent((prev) => ({
                    ...prev,
                    summary: { ...prev.summary, text: value },
                  }))
                }}
              >
                {resumeContent.summary.text}
              </p>
              {(() => {
                const summaryEdit = getEditForTarget(mappedSummaryTargetId, pendingEdits)
                if (summaryEdit) {
                  return (
                    <SuggestionDiff
                      edit={summaryEdit}
                      currentValue={resumeContent.summary.text}
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
              {resumeContent.experience.map((job) => (
                <div key={job.id} className={styles.resumeEntry}>
                  <div className={styles.entryHeader}>
                    <div className={styles.entryTitleWrapper}>
                      <span
                        className={styles.entryTitle}
                        contentEditable={editable}
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const value = e.currentTarget?.textContent?.trim() || ''
                          updateExperienceField(job.id, 'title', value)
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
                      className={styles.entryPeriod}
                      contentEditable={editable}
                      suppressContentEditableWarning
                      onBlur={(e) => {
                        const value = e.currentTarget?.textContent?.trim() || ''
                        updateExperienceField(job.id, 'period', value)
                      }}
                    >
                      {job.period.text}
                    </span>
                  </div>
                  <span
                    className={styles.entryCompany}
                    contentEditable={editable}
                    suppressContentEditableWarning
                    onBlur={(e) => {
                      const value = e.currentTarget?.textContent?.trim() || ''
                      updateExperienceField(job.id, 'company', value)
                    }}
                  >
                    {job.company.text}
                  </span>
                  <ul className={styles.entryBullets}>
                    {job.bullets.map((bullet) => {
                      const bulletTargetId = bullet.id
                      const bulletEdit = getEditForTarget(bulletTargetId, pendingEdits)
                      return (
                        <li key={bullet.id} className={styles.bulletItem}>
                          <span
                            contentEditable={editable}
                            suppressContentEditableWarning
                            onBlur={(e) => {
                              const value = e.currentTarget?.textContent?.trim() || ''
                              updateBullet(job.id, bullet.id, value)
                            }}
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
              {resumeContent.education.map((edu) => (
                <div key={edu.id} className={styles.resumeEntry}>
                  <div className={styles.entryHeader}>
                    <div className={styles.entryTitleWrapper}>
                      <span
                        className={styles.entryTitle}
                        contentEditable={editable}
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const value = e.currentTarget?.textContent?.trim() || ''
                          updateEducationField(edu.id, 'degree', value)
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
                      className={styles.entryPeriod}
                      contentEditable={editable}
                      suppressContentEditableWarning
                      onBlur={(e) => {
                        const value = e.currentTarget?.textContent?.trim() || ''
                        updateEducationField(edu.id, 'period', value)
                      }}
                    >
                      {edu.period.text}
                    </span>
                  </div>
                  <span
                    className={styles.entryCompany}
                    contentEditable={editable}
                    suppressContentEditableWarning
                    onBlur={(e) => {
                      const value = e.currentTarget?.textContent?.trim() || ''
                      updateEducationField(edu.id, 'school', value)
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
                        currentValue={
                          resumeContent.skills.find((s) => s.id === normalizeTargetId(edit.targetId))?.text ?? null
                        }
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
