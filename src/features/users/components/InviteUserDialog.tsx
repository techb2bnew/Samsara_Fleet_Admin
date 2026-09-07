import { useMemo, useState, type FormEvent } from 'react'
import { STRINGS } from '../../../constants'
import { Alert, Button, Field, FormGrid, Modal, Select, useToast } from '../../../components/ui'
import { useDepotOptions, useFleetData, type NewInvite } from '../../fleet-data'

const t = STRINGS.forms_common
const d = STRINGS.dialog
const u = STRINGS.users

/**
 * Invites a colleague to the console.
 *
 * The role and depot lists come from the database, not from a constant in this
 * file. A hardcoded list drifts the first time somebody adds a depot, and the
 * invitation would then be written against a fleet that does not exist.
 */
export function InviteUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { inviteUser, roles } = useFleetData()
  const { show } = useToast()

  const roleOptions = useMemo(
    () => roles.map((role) => ({ value: role.name, label: role.name })),
    [roles],
  )

  /** Empty means every depot — a null fleet_id, not a depot of its own. */
  const depotOptions = useDepotOptions(u.allDepots)

  const empty = useMemo<NewInvite>(
    () => ({
      name: '',
      email: '',
      // Dispatcher is the common case; falling back to whatever came first
      // keeps the form usable if the roles are still loading.
      role: roleOptions.find((r) => r.value === 'Dispatcher')?.value ?? roleOptions[0]?.value ?? '',
      depotId: '',
    }),
    [roleOptions],
  )

  const [values, setValues] = useState<NewInvite>(empty)
  const [errors, setErrors] = useState<Partial<Record<keyof NewInvite, string>>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const set = (key: keyof NewInvite) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }))

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const next: typeof errors = {}
    if (!values.name.trim()) next.name = d.required
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) next.email = d.invalidEmail
    if (!values.role) next.role = d.required

    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSaving(true)
    setSaveError(null)
    try {
      await inviteUser(values)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : u.inviteFailed)
      return
    } finally {
      setSaving(false)
    }

    show(t.inviteToast(values.email.trim().toLowerCase()))
    setValues(empty)
    setErrors({})
    onClose()
  }

  function handleClose() {
    setValues(empty)
    setErrors({})
    setSaveError(null)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t.inviteTitle}
      description={t.inviteDescription}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            {d.cancel}
          </Button>
          <Button type="submit" form="invite-user-form" loading={saving}>
            {t.inviteSubmit}
          </Button>
        </>
      }
    >
      <form id="invite-user-form" onSubmit={handleSubmit} noValidate>
        {saveError && (
          <div className="mb-4" role="alert">
            <Alert tone="danger">{saveError}</Alert>
          </div>
        )}

        {/*
          The notice about no email being sent was removed on request.

          What it said is still true: inviteStaff records an invitations row
          with a hashed token and sends nothing — there is no mail path for
          staff, the token it returns is discarded by the provider, and
          /accept-invite cannot resolve a token because the function that would
          look up its hash was never built.

          Left here as a note rather than silence, because the next person to
          read this file will otherwise assume the invitation works. The string
          is still in constants as `users.inviteNotEmailed`.
        */}

        <FormGrid>
          <Field
            label={t.inviteFields.name}
            value={values.name}
            onChange={set('name')}
            error={errors.name}
          />
          <Field
            label={t.inviteFields.email}
            type="email"
            placeholder="name@company.com"
            value={values.email}
            onChange={set('email')}
            error={errors.email}
          />
          <Select
            label={t.inviteFields.role}
            options={roleOptions}
            value={values.role}
            onChange={set('role')}
          />
          <Select
            label={t.inviteFields.depot}
            options={depotOptions}
            value={values.depotId}
            onChange={set('depotId')}
          />
        </FormGrid>
      </form>
    </Modal>
  )
}
