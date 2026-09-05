import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { STRINGS } from '../../../constants'
import { Alert, Button, Modal, Select, useToast } from '../../../components/ui'
import { useFleetData } from '../../fleet-data'
import type { Route } from '../types'

const t = STRINGS.dispatch.assign

export function AssignRouteDialog({
  open,
  route,
  kind,
  onClose,
}: {
  open: boolean
  route: Route | null
  kind: 'driver' | 'vehicle'
  onClose: () => void
}) {
  const { drivers, vehicles, assignRoute } = useFleetData()
  const { show } = useToast()
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const options = useMemo(() => {
    if (kind === 'driver') {
      return [
        { value: '', label: t.nobody },
        ...drivers
          .filter((driver) => driver.employment === 'active' && !driver.licenceExpired)
          .map((driver) => ({ value: driver.id, label: driver.name })),
      ]
    }
    return [
      { value: '', label: t.nobody },
      ...vehicles
        .filter((vehicle) => vehicle.status === 'active' && vehicle.kind === 'truck')
        .map((vehicle) => ({ value: vehicle.id, label: vehicle.name })),
    ]
  }, [kind, drivers, vehicles])

  useEffect(() => {
    if (!open || !route) return
    setValue(kind === 'driver' ? (route.driverId ?? '') : (route.vehicleId ?? ''))
    setError(null)
  }, [open, route, kind])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!route) return
    setSaving(true)
    setError(null)
    try {
      if (kind === 'driver') {
        await assignRoute(route.id, { driverId: value || null })
        const name = drivers.find((d) => d.id === value)?.name
        show(name ? t.driverToast(name, route.reference) : t.clearedDriver(route.reference))
      } else {
        await assignRoute(route.id, { vehicleId: value || null })
        const name = vehicles.find((v) => v.id === value)?.name
        show(name ? t.vehicleToast(name, route.reference) : t.clearedVehicle(route.reference))
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.failed)
    } finally {
      setSaving(false)
    }
  }

  if (!route) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={kind === 'driver' ? t.driverTitle : t.vehicleTitle}
      description={kind === 'driver' ? t.driverDescription : t.vehicleDescription}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {STRINGS.common.cancel}
          </Button>
          <Button type="submit" form="assign-route-form" loading={saving}>
            {t.submit}
          </Button>
        </>
      }
    >
      <form id="assign-route-form" onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="mb-4">
            <Alert tone="danger">{error}</Alert>
          </div>
        )}
        <Select
          label={kind === 'driver' ? t.driverField : t.vehicleField}
          options={options}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </form>
    </Modal>
  )
}
