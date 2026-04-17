import { X } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/utils/cn'
import styles from './ConfirmModal.module.css'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null

  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.title}>{title}</h2>
          <button className={styles.closeBtn} onClick={onCancel} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>
        
        <div className={styles.modalBody}>
          <p className={styles.message}>{message}</p>
        </div>

        <div className={styles.formActions}>
          <Button variant="secondary" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button 
            variant="primary" 
            onClick={onConfirm} 
            className={styles.dangerBtn}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}