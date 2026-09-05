import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { STRINGS } from '../../../constants'
import { Button, FormGrid, Modal, Select } from '../../../components/ui'
import type { Driver } from '../../drivers/types'
import type { Vehicle } from '../../vehicles/types'

const t = STRINGS.hours

type Segment = { id: string; vehicle: string; period: string; distanceKm: number }

export function AssignDrivingDialog({
  segment,
  drivers,
  vehicles,
  onClose,
  onAssign,
}: {
  segment: Segment | null
  drivers: Driver[]
  vehicles: Vehicle[]
  onClose: () => void
  onAssign: (driverName: string) => void
}) {
  const options = useMemo(
    () => drivers.map((driver) => ({ value: driver.name, label: driver.name })),
    [drivers],
  )
  const [driver, setDriver] = useState('')

  const usual =
    (segment && vehicles.find((vehicle) => vehicle.name === segment.vehicle)?.driver) || ''
  const selected = options.some((option) => option.value === (driver || usual))
    ? driver || usual
    : (options[0]?.value ?? '')

  useEffect(() => {
    setDriver('')
  }, [segment?.id])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!selected) return
    onAssign(selected)
  }

  return (
    <Modal
      open={segment !== null}
      onClose={onClose}
      title={t.assignTitle}
      description={t.assignHint}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {STRINGS.common.cancel}
          </Button>
          <Button type="submit" form="assign-driving-form" disabled={!selected}>
            {t.assignSubmit}
          </Button>
        </>
      }
    >
      {segment && (
        <form id="assign-driving-form" onSubmit={handleSubmit}>
          <p className="mb-4 text-[13.5px] text-ink-2">
            {segment.vehicle} · {segment.period} · {segment.distanceKm} km
          </p>
          <FormGrid>
            <Select
              label={t.assignDriver}
              options={options}
              value={selected}
              onChange={(event) => setDriver(event.target.value)}
            />
          </FormGrid>
        </form>
      )}
    </Modal>
  )
}
