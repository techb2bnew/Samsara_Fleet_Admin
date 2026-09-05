import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { STRINGS } from '../../../constants'
import { Alert, Button, FormGrid, FormRow, Field, Modal, Select, useToast } from '../../../components/ui'
import { useFleetData, type DriverAddResult, type NewDriver } from '../../fleet-data'
import { DepotSelect } from '../../settings/components/DepotSelect'
import { InviteHandover } from './InviteHandover'
import { EMPLOYMENT_LABEL, type Driver, type DriverEmployment } from '../types'

const t = STRINGS.forms_common
const d = STRINGS.dialog

const EMPTY: NewDriver = {
  firstName: '',
  lastName: '',
  employeeNumber: '',
  depotId: '',
  email: '',
  phone: '',
  licenceExpires: '',
  employment: 'active',
  currentLicenceExpires: '',
  vehicleId: '',
}

function driverSaveMessage(error: unknown) {
  const message = error instanceof Error ? error.message : t.addDriverFailed
  return message.includes('drivers_employee_number') ? t.addDriverDuplicateEmployee : message
}

function fromDriver(driver: Driver): NewDriver {
  return {
    firstName: driver.firstName,
    lastName: driver.lastName,
    employeeNumber: driver.employeeNumber,
    depotId: driver.depot?.id ?? '',
    email: driver.email,
    phone: driver.phone,
    licenceExpires: driver.licenceExpiresOn ?? '',
    employment: driver.employment,
    currentLicenceExpires: driver.licenceExpiresOn ?? '',
    vehicleId: driver.vehicleId ?? '',
  }
}

export function AddDriverDialog({
  open,
  driver = null,
  onClose,
}: {
  open: boolean
  driver?: Driver | null
  onClose: () => void
}) {
  const { addDriver, saveDriver, vehicles } = useFleetData()
  const { show } = useToast()
  const editing = driver !== null

  const [values, setValues] = useState<NewDriver>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof NewDriver, string>>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  /**
   * Set when the account was created but the email failed. Holds the only copy
   * of the one-time password, so it is shown until dismissed rather than
   * flashed in a toast.
   */
  const [handover, setHandover] = useState<
    { name: string; email: string; password: string; reason?: string } | null
  >(null)

  useEffect(() => {
    if (!open) return
    setValues(driver ? fromDriver(driver) : EMPTY)
    setErrors({})
    setSaveError(null)
    setHandover(null)
  }, [open, driver])

  const set = (key: keyof NewDriver) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }))

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const next: typeof errors = {}
    if (!values.firstName.trim()) next.firstName = d.required
    if (!values.lastName.trim()) next.lastName = d.required
    if (!values.employeeNumber.trim()) next.employeeNumber = d.required
    if (!values.depotId) next.depotId = d.required
    if (!values.email.trim()) next.email = d.required
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) next.email = d.invalidEmail
    if (!values.phone.trim()) next.phone = d.required
    else if (values.phone.replace(/\D/g, '').length < 8) next.phone = d.invalidPhone

    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSaving(true)
    setSaveError(null)

    const name = `${values.firstName} ${values.lastName}`.trim()

    if (driver) {
      try {
        await saveDriver(driver.id, values)
      } catch (error) {
        setSaveError(driverSaveMessage(error))
        return
      } finally {
        setSaving(false)
      }
      show(t.editDriverToast(name))
      onClose()
      return
    }

    let result: DriverAddResult
    try {
      result = await addDriver(values)
    } catch (error) {
      setSaveError(driverSaveMessage(error))
      return
    } finally {
      setSaving(false)
    }

    if (result.password) {
      setHandover({ name, email: values.email.trim().toLowerCase(), password: result.password, reason: result.reason })
      return
    }

    show(
      result.emailed
        ? t.addDriverInvitedToast(name)
        : result.reason
          ? t.addDriverNoInviteToast(name)
          : t.addDriverToast(name),
    )
    onClose()
  }

  function handleClose() {
    setHandover(null)
    onClose()
  }

  const employmentOptions = (Object.keys(EMPLOYMENT_LABEL) as DriverEmployment[]).map((key) => ({
    value: key,
    label: EMPLOYMENT_LABEL[key],
  }))

  const vehicleOptions = useMemo(() => {
    const eligible = vehicles.filter((row) => row.status === 'active' && row.kind === 'truck')
    const atDepot = values.depotId
      ? eligible.filter((row) => row.depot?.id === values.depotId)
      : eligible
    const listed = values.depotId && atDepot.length > 0 ? atDepot : eligible
    return [
      { value: '', label: t.driverFields.noVehicle },
      ...listed.map((row) => {
        const taken = row.driverId && row.driverId !== driver?.id
        return {
          value: row.id,
          label: taken && row.driver ? t.driverFields.currentlyHeld(row.name, row.driver) : row.name,
        }
      }),
    ]
  }, [vehicles, values.depotId, driver?.id])

  if (handover) {
    return (
      <InviteHandover
        open={open}
        name={handover.name}
        email={handover.email}
        password={handover.password}
        reason={handover.reason}
        onClose={handleClose}
      />
    )
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={editing ? t.editDriverTitle : t.addDriverTitle}
      description={editing ? t.editDriverDescription : t.addDriverDescription}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            {d.cancel}
          </Button>
          <Button type="submit" form="driver-form" loading={saving}>
            {editing ? t.editDriverSubmit : t.addDriverSubmit}
          </Button>
        </>
      }
    >
      <form id="driver-form" onSubmit={handleSubmit} noValidate>
        {saveError && (
          <div className="mb-4" role="alert">
            <Alert tone="danger">{saveError}</Alert>
          </div>
        )}
        <FormGrid>
          <Field
            label={t.driverFields.firstName}
            value={values.firstName}
            onChange={set('firstName')}
            error={errors.firstName}
            required
            autoFocus
          />
          <Field
            label={t.driverFields.lastName}
            value={values.lastName}
            onChange={set('lastName')}
            error={errors.lastName}
            required
          />
          <Field
            label={t.driverFields.employeeNumber}
            placeholder="NL-000"
            value={values.employeeNumber}
            onChange={set('employeeNumber')}
            error={errors.employeeNumber}
            required
          />
          <DepotSelect
            label={t.driverFields.depot}
            emptyLabel={d.noDepot}
            value={values.depotId}
            onChange={(depotId) =>
              setValues((current) => {
                const stillListed =
                  !depotId ||
                  vehicles.some(
                    (row) => row.id === current.vehicleId && row.depot?.id === depotId,
                  )
                return { ...current, depotId, vehicleId: stillListed ? current.vehicleId : '' }
              })
            }
            required
            error={errors.depotId}
          />
          <Select
            label={t.driverFields.vehicle}
            hint={t.driverFields.vehicleHint}
            options={vehicleOptions}
            value={values.vehicleId}
            onChange={set('vehicleId')}
          />
          <Field
            label={t.driverFields.email}
            type="email"
            placeholder="name@company.com"
            value={values.email}
            onChange={set('email')}
            error={errors.email}
            hint={editing ? t.driverFields.emailEditHint : undefined}
            required
          />
          <Field
            label={t.driverFields.phone}
            type="tel"
            value={values.phone}
            onChange={set('phone')}
            error={errors.phone}
            required
          />
          {editing && (
            <Select
              label={t.driverFields.employment}
              options={employmentOptions}
              value={values.employment}
              onChange={set('employment')}
            />
          )}
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
