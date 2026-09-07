import { STRINGS } from '../../../constants'
import { Alert, Button, Modal } from '../../../components/ui'

const t = STRINGS.forms_common

/**
 * Shown when the app invitation did not go as planned, in either of the two
 * ways it can fail.
 *
 * With a password: the account exists and only the email failed, so the office
 * passes the password on by hand. It is the only copy, which is why it stays
 * on screen until dismissed rather than flashing in a toast.
 *
 * Without one: the account was never created — a duplicate email, a missing
 * key, a provider that refused. That case used to be a toast saying "the app
 * invitation did not go", with the actual reason computed and then thrown
 * away, so the office saw a driver appear, no email, and nothing to act on.
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
  /** Empty when no account was created — there is no password to hand over. */
  password: string
  reason?: string
  onClose: () => void
}) {
  if (!password) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title={t.inviteFailedTitle}
        description={t.inviteFailedDescription(name)}
        footer={<Button onClick={onClose}>{t.inviteFailedDone}</Button>}
      >
        <div className="flex flex-col gap-4">
          <Alert tone="danger" title={t.inviteFailedWhat}>
            {reason}
          </Alert>
          <p className="text-[13px] text-ink-3">{t.inviteFailedNext}</p>
        </div>
      </Modal>
    )
  }

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
