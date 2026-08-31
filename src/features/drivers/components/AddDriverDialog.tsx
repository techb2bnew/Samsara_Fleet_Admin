import { useState, type FormEvent } from 'react'
import { STRINGS } from '../../../constants'
import { Button, FormGrid, FormRow, Field, Modal, Select, useToast } from '../../../components/ui'
import { useFleetData, type NewDriver } from '../../fleet-data'

const t = STRINGS.forms_common
const d = STRINGS.dialog

const TERMINALS = [
  { value: 'Pune depot', label: 'Pune depot' },
  { value: 'Nashik depot', label: 'Nashik depot' },
]

const EMPTY: NewDriver = {
  firstName: '',
  lastName: '',
  employeeNumber: '',
  terminal: TERMINALS[0].value,
  email: '',
  phone: '',
  licenceExpires: '',
}

export function AddDriverDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addDriver } = useFleetData()
  const { show } = useToast()
  const [values, setValues] = useState<NewDriver>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof NewDriver, string>>>({})

  const set = (key: keyof NewDriver) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }))

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const next: typeof errors = {}
    if (!values.firstName.trim()) next.firstName = d.required
    if (!values.lastName.trim()) next.lastName = d.required
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      next.email = d.invalidEmail
    }

    setErrors(next)
    if (Object.keys(next).length > 0) return

    addDriver(values)
    show(t.addDriverToast(`${values.firstName} ${values.lastName}`.trim()))
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
      title={t.addDriverTitle}
      description={t.addDriverDescription}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            {d.cancel}
          </Button>
          <Button type="submit" form="add-driver-form">
            {t.addDriverSubmit}
          </Button>
        </>
      }
    >
      <form id="add-driver-form" onSubmit={handleSubmit} noValidate>
        <FormGrid>
          <Field
            label={t.driverFields.firstName}
            value={values.firstName}
            onChange={set('firstName')}
            error={errors.firstName}
          />
          <Field
            label={t.driverFields.lastName}
            value={values.lastName}
            onChange={set('lastName')}
            error={errors.lastName}
          />
          <Field
            label={t.driverFields.employeeNumber}
            placeholder="NL-000"
            value={values.employeeNumber}
            onChange={set('employeeNumber')}
          />
          <Select
            label={t.driverFields.terminal}
            options={TERMINALS}
            value={values.terminal}
            onChange={set('terminal')}
          />
          <Field
            label={t.driverFields.email}
            type="email"
            placeholder="name@company.com"
            value={values.email}
            onChange={set('email')}
            error={errors.email}
          />
          <Field
            label={t.driverFields.phone}
            type="tel"
            value={values.phone}
            onChange={set('phone')}
          />
          <FormRow>
            <Field
              label={t.driverFields.licenceExpires}
              type="date"
              value={values.licenceExpires}
              onChange={set('licenceExpires')}
              hint="Used for the expiry warnings in the console."
            />
          </FormRow>
        </FormGrid>
      </form>
    </Modal>
  )
}
