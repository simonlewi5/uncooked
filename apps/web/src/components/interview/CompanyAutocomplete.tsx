import { useState, useEffect, useRef, useCallback, useId } from 'react'
import { useCompanySearch } from '@/hooks/useCompanySearch'
import type { CompanyProfile } from '@/types'
import { cn } from '@/utils/cn'
import { CompanyLogo } from './CompanyLogo'
import styles from './CompanyAutocomplete.module.css'

interface CompanyAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onProfileSelect: (profile: CompanyProfile) => void
  onCreateCompany: (companyName: string) => void
}

export function CompanyAutocomplete({
  value,
  onChange,
  onProfileSelect,
  onCreateCompany,
}: CompanyAutocompleteProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputId = useId()
  const { results, isLoading } = useCompanySearch(value)

  const hasTypedValue = value.trim().length > 0
  const shouldShowDropdown = isOpen && (results.length > 0 || isLoading || hasTypedValue)
  // check company is not in db and valid string before showing create option
  const shouldShowCreateOption = !isLoading && results.length === 0 && hasTypedValue  

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
      <label className={styles.label} htmlFor={inputId}>
        Company name
      </label>
      <input
        id={inputId}
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
          {isLoading && results.length === 0 && (
            <li className={styles.dropdownLoading}>Searching…</li>
          )}
          {results.map((profile, index) => (
            <li
              key={profile.id}
              className={cn(
                styles.dropdownItem,
                index === highlightedIndex && styles.dropdownItemHighlighted,
              )}
              role="option"
              aria-selected={index === highlightedIndex}
              onMouseDown={() => selectProfile(profile)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <CompanyLogo company={profile} size="sm" />
              <div className={styles.dropdownItemText}>
                <span className={styles.dropdownItemName}>{profile.companyName}</span>
                {profile.industry && (
                  <span className={styles.dropdownItemMeta}>{profile.industry}</span>
                )}
              </div>
            </li>
          ))}
          {shouldShowCreateOption && (
            <li
              className={styles.dropdownItem}
              role="option"
              aria-selected={false}
              onMouseDown={() => onCreateCompany(value.trim())}
            >
              <div className={styles.dropdownItemText}>
                <span className={styles.dropdownItemName}>
                  "{value.trim()}" - Save company
                </span>
              </div>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
