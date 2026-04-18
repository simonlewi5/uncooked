import { useEffect } from 'react'
import { cn } from '@/utils/cn'
import styles from './Toast.module.css'

interface StandardToastProps {
  message: string
  variant?: 'success' | 'error'
  onDone: () => void
}

export function StandardToast({ message, variant = 'success', onDone }: StandardToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2500) 
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <div className={cn(styles.toast, variant === 'success' ? styles.success : styles.error)}>
      <span>{message}</span>
    </div>
  )
}