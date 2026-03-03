import { forwardRef, TextareaHTMLAttributes, useId } from 'react'
import { cn } from '@/utils/cn'
import styles from './Textarea.module.css'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id: idProp, maxLength, value, ...props }, ref) => {
    const generatedId = useId()
    const id = idProp ?? generatedId
    const charCount = typeof value === 'string' ? value.length : 0

    return (
      <div className={styles.wrapper}>
        {label && (
          <div className={styles.labelRow}>
            <label htmlFor={id} className={styles.label}>
              {label}
            </label>
            {maxLength != null && (
              <span
                className={cn(
                  styles.charCount,
                  charCount > maxLength * 0.9 && styles.charCountWarn,
                )}
              >
                {charCount}/{maxLength}
              </span>
            )}
          </div>
        )}
        <textarea
          ref={ref}
          id={id}
          maxLength={maxLength}
          value={value}
          className={cn(styles.textarea, error && styles.hasError, className)}
          {...props}
        />
        {error && <p className={styles.error}>{error}</p>}
        {!error && hint && <p className={styles.hint}>{hint}</p>}
      </div>
    )
  },
)

Textarea.displayName = 'Textarea'
