import { useMemo, useState, type FormEvent } from 'react'
import { STRINGS } from '../../../constants'
import { Alert, Button, Field, FormGrid, FormRow, Modal, Select, Textarea, useToast } from '../../../components/ui'
import { useFleetData, type NewRoute } from '../../fleet-data'

const t = STRINGS.forms_common
const d = STRINGS.dialog

export function PlanRouteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { drivers, vehicles, routes, addRoute } = useFleetData()
  const { show } = useToast()

  const driverOptions = useMemo(
    () => drivers.map((driver) => ({ value: driver.name, label: driver.name })),
    [drivers],
  )
  const vehicleOptions = useMemo(
    () =>
      vehicles
        .filter((vehicle) => vehicle.status === 'active')
        .map((vehicle) => ({ value: vehicle.name, label: vehicle.name })),
    [vehicles],
  )

  const empty: NewRoute = {
    driver: driverOptions[0]?.value ?? '',
    vehicle: vehicleOptions[0]?.value ?? '',
    stops: '6',
    startTime: '',
    notes: '',
  }

  const [values, setValues] = useState<NewRoute>(empty)
  const [errors, setErrors] = useState<Partial<Record<keyof NewRoute, string>>>({})

  const set = (key: keyof NewRoute) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }))

  /**
   * A dispatcher must not be able to hand out work a driver has no legal hours
   * to finish. The warning appears as soon as the driver is chosen rather than
   * on submit, so it informs the choice instead of blocking it afterwards.
   */
  const chosenDriver = drivers.find((driver) => driver.name === values.driver)
  const noHoursLeft = chosenDriver?.hoursLeft === '0:00' || chosenDriver?.hoursLeft === '—'

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const next: typeof errors = {}
    if (!values.driver) next.driver = d.required
    if (!values.vehicle) next.vehicle = d.required
    if (!values.stops || Number(values.stops) < 1) next.stops = d.required

    setErrors(next)
    if (Object.keys(next).length > 0) return

    addRoute(values)
    show(t.routeToast(`NL-${4500 + routes.length}`))
    setValues(empty)
    setErrors({})
    onClose()
  }

  function handleClose() {
    setValues(empty)
    setErrors({})
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t.routeTitle}
      description={t.routeDescription}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            {d.cancel}
          </Button>
          <Button type="submit" form="plan-route-form">
            {t.routeSubmit}
          </Button>
        </>
      }
    >
      <form id="plan-route-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {noHoursLeft && chosenDriver && (
          <Alert tone="danger">{t.routeHoursWarning(chosenDriver.name)}</Alert>
        )}

        <FormGrid>
          <Select
            label={t.routeFields.driver}
            options={driverOptions}
            value={values.driver}
            onChange={set('driver')}
            error={errors.driver}
          />
          <Select
            label={t.routeFields.vehicle}
            options={vehicleOptions}
            value={values.vehicle}
            onChange={set('vehicle')}
            error={errors.vehicle}
          />
          <Field
            label={t.routeFields.stops}
            type="number"
            min={1}
            value={values.stops}
            onChange={set('stops')}
            error={errors.stops}
          />
          <Field
            label={t.routeFields.startTime}
            type="time"
            value={values.startTime}
            onChange={set('startTime')}
          />
          <FormRow>
            <Textarea
              label={t.routeFields.notes}
              value={values.notes}
              onChange={set('notes')}
              placeholder="Anything the driver needs to know before setting off"
            />
          </FormRow>
        </FormGrid>
      </form>
    </Modal>
  )
}
