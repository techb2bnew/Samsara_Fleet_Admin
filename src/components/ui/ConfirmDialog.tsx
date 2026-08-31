import { Modal } from './Modal'
import { Button } from './Button'
import { STRINGS } from '../../constants'

/**
 * Confirmation before anything the user cannot simply undo.
 *
 * `tone` decides whether the confirm button reads as an ordinary action or a
 * destructive one — a red button for "sign out" would be alarming, and a blue
 * one for "delete" too quiet.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  tone = 'primary',
  loading = false,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel: string
  tone?: 'primary' | 'danger'
  loading?: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {STRINGS.common.cancel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[14px] leading-relaxed text-ink-2">{message}</p>
    </Modal>
  )
}
