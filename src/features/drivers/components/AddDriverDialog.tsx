import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { STRINGS } from '../../../constants'
import { Alert, Button, FormGrid, FormRow, Field, Modal, Select, useToast } from '../../../components/ui'
import { useFleetData, type DriverAddResult, type NewDriver } from '../../fleet-data'
import { DepotSelect } from '../../settings/components/DepotSelect'
import { InviteHandover } from './InviteHandover'
import { EMPLOYMENT_LABEL, type Driver, type DriverEmployment } from '../types'
import { personName } from '../../../lib/names'

const t = STRINGS.forms_common
const d = STRINGS.dialog

/*
 * How many digits a phone number is.
 *
 * Ten, matching the organisation's country. The box caps at this and the
 * check below requires exactly it, so the two cannot disagree — the check
 * used to accept eight and the box accepted anything at all.
 */
const PHONE_DIGITS = 10

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

  /*
   * The phone box, which took as many digits as somebody cared to type.
   *
   * Digits only and ten of them. The validation below already counted digits
   * rather than characters, so there was a floor and no ceiling: a slipped
   * keypress produced a fourteen-digit number that saved happily and reached
   * a driver's record, where the only way to notice was to read it.
   *
   * A pasted number that carries India's country code is the one case worth
   * handling rather than truncating: "+91 98765 43210" strips to twelve
   * digits, and taking the FIRST ten of those would silently store a wrong
   * number that looks right. Dropping a leading 91 is only done when it
   * leaves exactly ten, so it can never mangle a number it did not
   * understand.
   *
   * Past ten, further keystrokes do nothing. That is what a maximum length
   * does everywhere else, and it beats shifting digits the office already
   * typed.
   */
  const setPhone = (event: { target: { value: string } }) => {
    let digits = event.target.value.replace(/\D/g, '')
    if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
    setValues((current) => ({ ...current, phone: digits.slice(0, PHONE_DIGITS) }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const next: typeof errors = {}
    if (!values.firstName.trim()) next.firstName = d.required
    if (!values.lastName.trim()) next.lastName = d.required
    /*
     * Not required. The column is nullable and always was — this form was
     * stricter than the schema for no reason, and a fleet that does not use
     * employee numbers had to invent one to add a driver.
     *
     * It is still unique when given: two drivers sharing a number is what the
     * duplicate check below catches.
     */
    /*
     * Depot is not required either. fleet_id is nullable, the picker has
     * always offered "No depot", and a new driver who has not been placed at
     * one yet is an ordinary thing — the console was refusing to record
     * somebody it could perfectly well store.
     */
    if (!values.email.trim()) next.email = d.required
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) next.email = d.invalidEmail
    if (!values.phone.trim()) next.phone = d.required
    else if (values.phone.replace(/\D/g, '').length !== PHONE_DIGITS)
      next.phone = d.invalidPhone

    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSaving(true)
    setSaveError(null)

    // The toast says the name back; it should read the way the roster will.
    const name = personName(values.firstName, values.lastName)

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

    /*
     * Anything that went wrong gets a dialog, not a toast.
     *
     * Two different failures land here: the account exists and the email
     * failed (there is a password to hand over), or the account was never
     * created (there is not). Both need the office to do something, and a
     * toast that disappears — with the reason dropped entirely — was telling
     * them neither.
     */
    if (result.password || result.reason) {
      setHandover({
        name,
        email: values.email.trim().toLowerCase(),
        password: result.password ?? '',
        reason: result.reason,
      })
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
          {/*
            The four required fields first, in two rows, then everything
            optional. Email used to sit in the third row beside Vehicle and
            phone alone in the fourth, so the things a driver cannot be added
            without were scattered among the things they can.
          */}
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
            inputMode="numeric"
            /*
             * No maxLength attribute: it counts CHARACTERS, so pasting
             * "+91 98765 43210" would be cut to "+91 98765 " before
             * setPhone ever saw it. The cap lives in setPhone, which counts
             * digits.
             */
            value={values.phone}
            onChange={setPhone}
            error={errors.phone}
            required
          />
          <Field
            label={t.driverFields.employeeNumber}
            hint={t.driverFields.employeeNumberHint}
            placeholder="NL-000"
            value={values.employeeNumber}
            onChange={set('employeeNumber')}
            error={errors.employeeNumber}
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
            error={errors.depotId}
          />
          <Select
            label={t.driverFields.vehicle}
            hint={t.driverFields.vehicleHint}
            options={vehicleOptions}
            value={values.vehicleId}
            onChange={set('vehicleId')}
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
