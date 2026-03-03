import { useState, FormEvent } from 'react'
import { Input, Textarea, Button } from '@/components/ui'
import type { JobDescriptionFormValue } from '@/types'
import styles from './JobDescriptionForm.module.css'

interface JobDescriptionFormProps {
  onSubmit: (value: JobDescriptionFormValue) => void
}

export function JobDescriptionForm({ onSubmit }: JobDescriptionFormProps) {
  const [jobDescription, setJobDescription] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companyContext, setCompanyContext] = useState('')
  const [errors, setErrors] = useState<Partial<Record<keyof JobDescriptionFormValue, string>>>({})

  const validate = (): boolean => {
    const next: typeof errors = {}
    if (!jobDescription.trim()) next.jobDescription = 'Job description is required'
    if (!companyName.trim()) next.companyName = 'Company name is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    onSubmit({ jobDescription, companyName, companyContext })
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div>
        <p className={styles.title}>Tell us about the role</p>
        <p className={styles.subtitle}>
          We&apos;ll use this to tailor your interview questions.
        </p>
      </div>

      <Input
        label="Company name"
        placeholder="e.g. Acme Corp"
        value={companyName}
        onChange={(e) => setCompanyName(e.target.value)}
        error={errors.companyName}
        required
      />

      <Textarea
        label="Job description"
        placeholder="Paste the full job description here…"
        value={jobDescription}
        onChange={(e) => setJobDescription(e.target.value)}
        error={errors.jobDescription}
        maxLength={5000}
        rows={8}
        required
      />

      <Textarea
        label="Company context (optional)"
        placeholder="Any extra context about the company, team, or role…"
        value={companyContext}
        onChange={(e) => setCompanyContext(e.target.value)}
        maxLength={5000}
        rows={4}
        hint="What does the company do? What's the team culture like?"
      />

      <div className={styles.actions}>
        <Button type="submit" size="md">
          Next: Choose interview style
        </Button>
      </div>
    </form>
  )
}
