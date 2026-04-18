import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import styles from './AddCompanyPage.module.css'

interface AddCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCompanyName?: string;
  onSuccess: (newCompanyId: string, companyName: string) => void;
}

export default function AddCompanyModal({ 
  isOpen, 
  onClose, 
  initialCompanyName = '', 
  onSuccess 
}: AddCompanyModalProps): JSX.Element | null {
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    companyName: initialCompanyName,
    companyWebsite: '',
    industry: '',
    companySize: '',
    location: '',
    notes: '',
  })


  useEffect(() => {
    if (isOpen) {
      setFormData(prev => ({ ...prev, companyName: initialCompanyName }));
      setError(null);
    }
  }, [isOpen, initialCompanyName]);

  if (!isOpen) return null;

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!user) {
      setError('You must be logged in to add a company.')
      return
    }

    if (!formData.companyName.trim()) {
      setError('Company name is required.')
      return
    }

    setIsLoading(true)

    try {
      const { data, error: insertError } = await supabase
        .from('company_profiles')
        .insert({
          user_id: user.id,
          company_name: formData.companyName.trim(),
          company_website: formData.companyWebsite.trim() || null,
          industry: formData.industry.trim() || null,
          company_size: formData.companySize.trim() || null,
          location: formData.location.trim() || null,
          notes: formData.notes.trim() || null,
        })
        .select('id, company_name')
        .single<{ id: string, company_name: string }>()

      if (insertError) throw insertError

      // Pass the new data back to ResearchPage and reset the form
      onSuccess(data.id, data.company_name)
      setFormData({
        companyName: '',
        companyWebsite: '',
        industry: '',
        companySize: '',
        location: '',
        notes: '',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add company'
      setError(message)
      console.error('AddCompanyModal: failed to create company', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.title}>Add Company</h2>
            <p className={styles.subtitle}>
              Fill in the details to add it to your research board
            </p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {error && <div className={styles.errorBanner}>{error}</div>}

          <div className={styles.formGroup}>
            <label htmlFor="companyName" className={styles.label}>
              Company Name <span className={styles.required}>*</span>
            </label>
            <input
              id="companyName"
              type="text"
              name="companyName"
              className={styles.input}
              placeholder="e.g. Acme Corp"
              value={formData.companyName}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="companyWebsite" className={styles.label}>
              Company Website
            </label>
            <input
              id="companyWebsite"
              type="url"
              name="companyWebsite"
              className={styles.input}
              placeholder="https://example.com"
              value={formData.companyWebsite}
              onChange={handleInputChange}
            />
          </div>

          <div className={styles.twoColumnRow}>
            <div className={styles.formGroup}>
              <label htmlFor="industry" className={styles.label}>
                Industry
              </label>
              <select
                id="industry"
                name="industry"
                className={styles.input}
                value={formData.industry}
                onChange={handleInputChange}
              >
                <option value="">Select an industry</option>
                <option value="Technology">Technology</option>
                <option value="Fintech">Fintech</option>
                <option value="Healthcare">Healthcare</option>
                <option value="E-commerce">E-commerce</option>
                <option value="DevTools">DevTools</option>
                <option value="AI/ML">AI/ML</option>
                <option value="SaaS">SaaS</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="companySize" className={styles.label}>
                Company Size
              </label>
              <select
                id="companySize"
                name="companySize"
                className={styles.input}
                value={formData.companySize}
                onChange={handleInputChange}
              >
                <option value="">Select company size</option>
                <option value="Startup (1-50)">Startup (1-50)</option>
                <option value="Small (51-200)">Small (51-200)</option>
                <option value="Mid-size (201-1000)">Mid-size (201-1000)</option>
                <option value="Large (1000+)">Large (1000+)</option>
                <option value="Enterprise">Enterprise</option>
              </select>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="location" className={styles.label}>
              Location
            </label>
            <input
              id="location"
              type="text"
              name="location"
              className={styles.input}
              placeholder="e.g. San Francisco, CA"
              value={formData.location}
              onChange={handleInputChange}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="notes" className={styles.label}>
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              className={styles.textarea}
              placeholder="Add any additional notes about the company..."
              value={formData.notes}
              onChange={handleInputChange}
              rows={3}
            />
          </div>

          <div className={styles.formActions}>
            <Button variant="secondary" type="button" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isLoading || !formData.companyName.trim()}>
              {isLoading ? 'Adding...' : 'Add Company'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}