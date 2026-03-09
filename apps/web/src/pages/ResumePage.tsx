import { useState, useEffect, useRef, KeyboardEvent } from 'react'
import html2pdf from 'html2pdf.js'
import { Download, Sparkles, Search, X, Plus } from 'lucide-react'
import { Button, Badge } from '@/components/ui'
import { useResumeTailor } from '@/hooks/useResumeTailor'
import type { ResumeTailorRequest } from '@/types'
import { cn } from '@/utils/cn'
import styles from './ResumePage.module.css'

interface ExperienceEntry {
  id: string
  title: string
  company: string
  period: string
  bullets: string[]
}

interface EducationEntry {
  id: string
  degree: string
  school: string
  period: string
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
      'Architected and migrated legacy dashboard to React/Next.js, improving page load speeds by 40%.',
      'Mentored 3 junior developers and established frontend testing standards using Jest and Cypress.',
    ],
  },
  {
    id: 'e2',
    title: 'UI Engineer',
    company: 'Brightwave Inc.',
    period: '2018 – 2021',
    bullets: [
      'Built reusable component library used across 6 product teams.',
      'Led accessibility audit — brought WCAG compliance from 60% to 98%.',
    ],
  },
]

const MOCK_EDUCATION: EducationEntry[] = [
  { id: 'ed1', degree: 'B.S. Computer Science', school: 'UC San Diego', period: '2014 – 2018' },
]

export default function ResumePage() {
  const resumeRef = useRef<HTMLDivElement>(null)
  const [jobDescription, setJobDescription] = useState('')
  const [skills, setSkills] = useState<string[]>([
    'React',
    'TypeScript',
    'Node.js',
    'GraphQL',
    'Tailwind CSS',
  ])
  const [skillInput, setSkillInput] = useState('')
  const [isTailored, setIsTailored] = useState(false)
  const [experience, setExperience] = useState<ExperienceEntry[]>(MOCK_EXPERIENCE)
  const [education, setEducation] = useState<EducationEntry[]>(MOCK_EDUCATION)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const { runTailor, isLoading, error: tailorError, clearError } = useResumeTailor()

  function addExperience() {
    setExperience((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        title: 'Job Title',
        company: 'Company Name',
        period: 'Year – Year',
        bullets: ['Describe your responsibilities here.'],
      },
    ])
  }

  function removeExperience(id: string) {
    setExperience((prev) => prev.filter((e) => e.id !== id))
  }

  function addBullet(expId: string) {
    setExperience((prev) =>
      prev.map((e) => (e.id === expId ? { ...e, bullets: [...e.bullets, 'New bullet point.'] } : e))
    )
  }

  function removeBullet(expId: string, index: number) {
    setExperience((prev) =>
      prev.map((e) =>
        e.id === expId ? { ...e, bullets: e.bullets.filter((_, i) => i !== index) } : e
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
      if (trimmed && !skills.includes(trimmed)) setSkills((prev) => [...prev, trimmed])
      setSkillInput('')
    }
  }

  function removeSkill(skill: string) {
    setSkills((prev) => prev.filter((s) => s !== skill))
  }

  useEffect(() => {
    if (!isTailored) return
    const t = setTimeout(() => setIsTailored(false), 10000)
    return () => clearTimeout(t)
  }, [isTailored])

  function buildResumeContent(): ResumeTailorRequest['resumeContent'] {
    return {
      name: MOCK_RESUME.name,
      contact: MOCK_RESUME.contact,
      summary: MOCK_RESUME.summary,
      experience: experience.map((entry) => ({
        title: entry.title,
        company: entry.company,
        period: entry.period,
        bullets: entry.bullets,
      })),
      education: education.map((entry) => ({
        degree: entry.degree,
        school: entry.school,
        period: entry.period,
      })),
      skills,
    }
  }

  async function handleAutoTailor() {
    clearError()
    setSubmitError(null)

    if (jobDescription.trim().length < 200) {
      setSubmitError('Please paste a longer job description (minimum 200 characters).')
      setIsTailored(false)
      return
    }

    const payload: ResumeTailorRequest = {
      jobDescription,
      skills,
      resumeContent: buildResumeContent(),
    }

    try {
      const result = await runTailor(payload)
      setSuggestions(result.suggestions)
      setIsTailored(true)
    } catch {
      setIsTailored(false)
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
                <span key={skill} className={styles.skillChip}>
                  {skill}
                  <button
                    className={styles.skillChipRemove}
                    onClick={() => removeSkill(skill)}
                    aria-label={`Remove ${skill}`}
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

          {isTailored && (
            <div className={styles.suggestionsBadge}>
              <Badge variant="success">AI Suggestions Applied</Badge>
            </div>
          )}

          {suggestions.length > 0 && (
            <div className={styles.suggestionsCard}>
              <p className={styles.suggestionsTitle}>AI Suggestions</p>
              <ul className={styles.suggestionsList}>
                {suggestions.map((suggestion, index) => (
                  <li key={`${suggestion}-${index}`}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}

          <div ref={resumeRef} className={styles.resumeDocument}>
            <div className={styles.resumeHeader}>
              <h2
                className={styles.resumeName}
                contentEditable={editable}
                suppressContentEditableWarning
              >
                {MOCK_RESUME.name}
              </h2>
              <p
                className={styles.resumeContact}
                contentEditable={editable}
                suppressContentEditableWarning
              >
                {MOCK_RESUME.contact}
              </p>
            </div>

            <div className={styles.resumeSection}>
              <h3 className={styles.sectionHeading}>Summary</h3>
              <p
                className={styles.resumeText}
                contentEditable={editable}
                suppressContentEditableWarning
              >
                {MOCK_RESUME.summary}
              </p>
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
                    >
                      {job.period}
                    </span>
                  </div>
                  <span
                    className={styles.entryCompany}
                    contentEditable={editable}
                    suppressContentEditableWarning
                  >
                    {job.company}
                  </span>
                  <ul className={styles.entryBullets}>
                    {job.bullets.map((bullet, i) => (
                      <li key={i} className={styles.bulletItem}>
                        <span contentEditable={editable} suppressContentEditableWarning>
                          {bullet}
                        </span>
                        <button
                          className={cn(styles.bulletRemoveBtn, !editable && styles.btnHidden)}
                          onClick={() => removeBullet(job.id, i)}
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
              {education.map((edu) => (
                <div key={edu.id} className={styles.resumeEntry}>
                  <div className={styles.entryHeader}>
                    <div className={styles.entryTitleWrapper}>
                      <span
                        className={styles.entryTitle}
                        contentEditable={editable}
                        suppressContentEditableWarning
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
                    >
                      {edu.period}
                    </span>
                  </div>
                  <span
                    className={styles.entryCompany}
                    contentEditable={editable}
                    suppressContentEditableWarning
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
          </div>
        </div>
      </div>
    </div>
  )
}
