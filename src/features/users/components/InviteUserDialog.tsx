import { useState, type FormEvent } from 'react'
import { STRINGS } from '../../../constants'
import { Button, Field, FormGrid, Modal, Select, useToast } from '../../../components/ui'
import { useFleetData, type NewInvite } from '../../fleet-data'
import { ROLE_SUMMARY } from '../../../mocks/people'

const t = STRINGS.forms_common
const d = STRINGS.dialog

const ROLES = ROLE_SUMMARY.map((r) => ({ value: r.name, label: r.name }))
const FLEETS = [
  { value: 'All fleets', label: 'All fleets' },
  { value: 'Pune depot', label: 'Pune depot' },
  { value: 'Nashik depot', label: 'Nashik depot' },
]

const EMPTY: NewInvite = { name: '', email: '', role: ROLES[1].value, fleet: FLEETS[0].value }

export function InviteUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { inviteUser } = useFleetData()
  const { show } = useToast()
  const [values, setValues] = useState<NewInvite>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof NewInvite, string>>>({})

  const set = (key: keyof NewInvite) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }))

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const next: typeof errors = {}
    if (!values.name.trim()) next.name = d.required
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) next.email = d.invalidEmail

    setErrors(next)
    if (Object.keys(next).length > 0) return

    inviteUser(values)
    show(t.inviteToast(values.email.trim().toLowerCase()))
    setValues(EMPTY)
    setErrors({})
    onClose()
  }

  function handleClose() {
    setValues(EMPTY)
    setErrors({})
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
          <Button type="submit" form="invite-user-form">
            {t.inviteSubmit}
          </Button>
        </>
      }
    >
      <form id="invite-user-form" onSubmit={handleSubmit} noValidate>
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
            options={ROLES}
            value={values.role}
            onChange={set('role')}
          />
          <Select
            label={t.inviteFields.fleet}
            options={FLEETS}
            value={values.fleet}
            onChange={set('fleet')}
          />
        </FormGrid>
      </form>
    </Modal>
  )
}
