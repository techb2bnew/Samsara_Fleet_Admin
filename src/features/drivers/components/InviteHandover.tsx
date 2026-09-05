import { STRINGS } from '../../../constants'
import { Alert, Button, Modal } from '../../../components/ui'

const t = STRINGS.forms_common

/**
 * Shown when the app account exists but the email did not go.
 *
 * This is the only copy of the one-time password, so it stays on screen until
 * dismissed rather than flashing in a toast.
 */
export function InviteHandover({
  open,
  name,
  email,
  password,
  reason,
  onClose,
}: {
  open: boolean
  name: string
  email: string
  password: string
  reason?: string
  onClose: () => void
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.handoverTitle}
      description={t.handoverDescription(name)}
      footer={<Button onClick={onClose}>{t.handoverDone}</Button>}
    >
      <div className="flex flex-col gap-4">
        <Alert tone="warning" title={t.handoverNotEmailed}>
          {reason}
        </Alert>
        <dl className="divide-y divide-line rounded-[10px] border border-line">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <dt className="text-[12.5px] text-ink-3">{t.driverFields.email}</dt>
            <dd className="font-mono text-[13px] text-ink">{email}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <dt className="text-[12.5px] text-ink-3">{t.handoverPassword}</dt>
            <dd className="font-mono text-[15px] font-semibold tracking-[0.08em] text-ink select-all">
              {password}
            </dd>
          </div>
        </dl>
        <p className="text-[12.5px] text-ink-3">{t.handoverHint}</p>
      </div>
    </Modal>
  )
}
