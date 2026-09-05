import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { STRINGS } from '../../../constants'
import { Alert, Button, Modal, Select, useToast } from '../../../components/ui'
import { useFleetData } from '../../fleet-data'
import type { Vehicle } from '../types'

const t = STRINGS.vehicles.assignDialog

/**
 * Puts a driver in a vehicle from the office side.
 *
 * The normal path is the driver choosing their own truck in the app at the
 * start of a shift — the schema was built for that, and row-level security
 * allows it. This is for the cases that path does not cover: pre-assigning
 * tomorrow's trucks, or fixing a wrong pick without waiting for the driver.
 */
export function AssignDriverDialog({
  open,
  vehicle,
  onClose,
}: {
  open: boolean
  vehicle: Vehicle
  onClose: () => void
}) {
  const { drivers, vehicles, assignDriver } = useFleetData()
  const { show } = useToast()

  const [driverId, setDriverId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Who is already in another vehicle, so the list can say so.
   *
   * A driver has one vehicle at a time, and assigning them here takes them out
   * of the other one. That is usually what was meant, but not always — so the
   * option says which truck they are leaving rather than doing it silently.
   */
  const heldBy = useMemo(() => {
    const out = new Map<string, string>()
    for (const other of vehicles) {
      if (other.id === vehicle.id || !other.driverId) continue
      out.set(other.driverId, other.name)
    }
    return out
  }, [vehicles, vehicle.id])

  const options = useMemo(
    () => [
      { value: '', label: t.nobody },
      ...drivers
        // A driver whose licence has expired is not legal to drive, so the
        // office should not be able to put them in a truck by accident.
        .filter((driver) => driver.employment === 'active' && !driver.licenceExpired)
        .map((driver) => {
          const holding = heldBy.get(driver.id)
          return {
            value: driver.id,
            label: holding ? t.currentlyOn(driver.name, holding) : driver.name,
          }
        }),
    ],
    [drivers, heldBy],
  )

  useEffect(() => {
    if (!open) return
    // Starts on whoever is in it now, so opening the dialog and saving without
    // touching anything changes nothing.
    setDriverId(vehicle.driverId ?? '')
    setError(null)
  }, [open, vehicle.driverId])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await assignDriver(vehicle.id, driverId || null)
      const name = drivers.find((d) => d.id === driverId)?.name
      show(name ? t.assignedToast(name, vehicle.name) : t.clearedToast(vehicle.name))
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.failed)
    } finally {
      setSaving(false)
    }
  }

  /* The truck the chosen driver is being taken out of, if any. */
  const movingFrom = driverId ? heldBy.get(driverId) : undefined
  const chosenName = drivers.find((d) => d.id === driverId)?.name

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.title(vehicle.name)}
      description={t.description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {STRINGS.common.cancel}
          </Button>
          <Button type="submit" form="assign-driver-form" loading={saving}>
            {t.submit}
          </Button>
        </>
      }
    >
      <form id="assign-driver-form" onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="mb-4">
            <Alert tone="danger">{error}</Alert>
          </div>
        )}
        {movingFrom && chosenName && (
          <div className="mb-4">
            <Alert tone="warning">{t.movesFrom(chosenName, movingFrom, vehicle.name)}</Alert>
          </div>
        )}
        {drivers.length === 0 ? (
          <Alert tone="neutral">{t.noDrivers}</Alert>
        ) : (
          <Select
            label={t.field}
            hint={t.hint}
            options={options}
            value={driverId}
            onChange={(event) => setDriverId(event.target.value)}
          />
        )}
      </form>
    </Modal>
  )
}
