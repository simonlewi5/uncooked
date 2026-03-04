import { useState, useEffect, useRef, useCallback } from 'react'
import { useCompanySearch } from '@/hooks/useCompanySearch'
import type { CompanyProfile } from '@/types'
import styles from './CompanyAutocomplete.module.css'

interface CompanyAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onProfileSelect: (profile: CompanyProfile) => void
}

function getLogoDomain(website: string | null): string | null {
  if (!website) return null
  try {
    return new URL(website.startsWith('http') ? website : `https://${website}`).hostname.replace(
      'www.',
      '',
    )
  } catch {
    return null
  }
}

interface LogoProps {
  company: CompanyProfile
}

function CompanyLogo({ company }: LogoProps): React.JSX.Element {
  const [imgFailed, setImgFailed] = useState(false)
  const domain = getLogoDomain(company.companyWebsite)
  const initials = company.companyName.slice(0, 2).toUpperCase()

  if (domain && !imgFailed) {
    return (
      <img
        className={styles.logo}
        src={`https://logo.clearbit.com/${domain}`}
        alt={company.companyName}
        onError={() => setImgFailed(true)}
      />
    )
  }

  return <div className={styles.logoFallback}>{initials}</div>
}

export function CompanyAutocomplete({
  value,
  onChange,
  onProfileSelect,
}: CompanyAutocompleteProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { results } = useCompanySearch(value)

  const shouldShowDropdown = isOpen && results.length > 0

  useEffect(() => {
    setHighlightedIndex(0)
  }, [results])

  useEffect(() => {
    function handleMouseDown(event: MouseEvent): void {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  const selectProfile = useCallback(
    (profile: CompanyProfile) => {
      onProfileSelect(profile)
      setIsOpen(false)
    },
    [onProfileSelect],
  )

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (!shouldShowDropdown) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightedIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedIndex((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const profile = results[highlightedIndex]
      if (profile) selectProfile(profile)
    } else if (event.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <label className={styles.label} htmlFor="company-autocomplete">
        Company name
      </label>
      <input
        id="company-autocomplete"
        ref={inputRef}
        className={styles.input}
        placeholder="e.g. Acme Corp"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
      />
      {shouldShowDropdown && (
        <ul className={styles.dropdown} role="listbox">
          {results.map((profile, index) => (
            <li
              key={profile.id}
              className={`${styles.dropdownItem} ${index === highlightedIndex ? styles.dropdownItemHighlighted : ''}`}
              role="option"
              aria-selected={index === highlightedIndex}
              onMouseDown={() => selectProfile(profile)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <CompanyLogo company={profile} />
              <div className={styles.dropdownItemText}>
                <span className={styles.dropdownItemName}>{profile.companyName}</span>
                {profile.industry && (
                  <span className={styles.dropdownItemMeta}>{profile.industry}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
