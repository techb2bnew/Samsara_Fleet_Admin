import { useMemo, useState, type FormEvent } from 'react'
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps'
import { STRINGS } from '../../../constants'
import { Alert, Button, ConfirmDialog, Field, FormGrid, FormRow, Modal, Select, Textarea, useToast } from '../../../components/ui'
import { HAS_MAPS_KEY } from '../../live-map/components/FleetMap'
import { useFleetData, type NewRoute } from '../../fleet-data'
import type { DepotRow } from '../../../supabase/api'
import { formatKm } from '../geometry'
import { placeholderStops, planAlongRoute } from '../planAlongRoute'
import type { Route } from '../types'

const t = STRINGS.forms_common
const d = STRINGS.dialog
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()
const OTHER = '__other__'

const EMPTY: NewRoute = {
  driverId: '',
  vehicleId: '',
  origin: '',
  destination: '',
  stops: '6',
  startTime: '',
  notes: '',
  plannedDistanceKm: null,
  pathPolyline: null,
  plannedStops: [],
}

type PlacePick = { query: string; label: string; at: { lat: number; lng: number } | null }

function placeFrom(
  id: string,
  other: string,
  depots: DepotRow[],
): PlacePick | 'empty' | 'needs-location' {
  if (!id) return 'empty'
  if (id === OTHER) {
    const query = other.trim()
    return query ? { query, label: query, at: null } : 'empty'
  }
  const depot = depots.find((row) => row.id === id)
  if (!depot) return 'empty'
  const address = depot.address.trim()
  const at =
    depot.latitude != null && depot.longitude != null
      ? { lat: depot.latitude, lng: depot.longitude }
      : null
  if (address || at) {
    return {
      query: address || `${at!.lat},${at!.lng}`,
      label: depot.name,
      at,
    }
  }
  return 'needs-location'
}

export function PlanRouteDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated?: (route: Route) => void
}) {
  if (!open) return null
  if (!API_KEY) return <PlanRouteForm open onClose={onClose} onCreated={onCreated} maps={null} />

  return (
    <APIProvider apiKey={API_KEY}>
      <PlanRouteMapsBridge open onClose={onClose} onCreated={onCreated} />
    </APIProvider>
  )
}

function PlanRouteMapsBridge({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated?: (route: Route) => void
}) {
  const maps = useMapsLibrary('maps')
  const geocoding = useMapsLibrary('geocoding')
  const ready = maps && geocoding ? google.maps : null
  return <PlanRouteForm open={open} onClose={onClose} onCreated={onCreated} maps={ready} />
}

function PlanRouteForm({
  open,
  onClose,
  onCreated,
  maps,
}: {
  open: boolean
  onClose: () => void
  onCreated?: (route: Route) => void
  maps: typeof google.maps | null
}) {
  const { drivers, vehicles, depots, routes, addRoute } = useFleetData()
  const { show } = useToast()

  const driverOptions = useMemo(
    () => [
      { value: '', label: t.routeChooseDriver },
      ...drivers
        .filter((driver) => driver.employment === 'active' && !driver.licenceExpired)
        .map((driver) => ({
          value: driver.id,
          label: driver.vehicle ? `${driver.name} · ${driver.vehicle}` : driver.name,
        })),
    ],
    [drivers],
  )
  const vehicleOptions = useMemo(
    () => [
      { value: '', label: t.routeChooseVehicle },
      ...vehicles
        .filter((vehicle) => vehicle.status === 'active' && vehicle.kind === 'truck')
        .map((vehicle) => ({
          value: vehicle.id,
          label: vehicle.driver ? `${vehicle.name} · ${vehicle.driver}` : vehicle.name,
        })),
    ],
    [vehicles],
  )
  const depotOptions = useMemo(
    () => [
      ...depots.map((depot) => ({
        value: depot.id,
        label: depot.address ? depot.name : `${depot.name} — no address`,
      })),
      { value: OTHER, label: t.routeOtherAddress },
    ],
    [depots],
  )

  const [values, setValues] = useState<NewRoute>(EMPTY)
  const [originId, setOriginId] = useState('')
  const [destinationId, setDestinationId] = useState('')
  const [originOther, setOriginOther] = useState('')
  const [destinationOther, setDestinationOther] = useState('')
  const [errors, setErrors] = useState<{
    origin?: string
    destination?: string
    stops?: string
    driverId?: string
    vehicleId?: string
    startTime?: string
  }>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmHours, setConfirmHours] = useState(false)

  const set = (key: keyof NewRoute) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }))

  const chosenDriver = drivers.find((driver) => driver.id === values.driverId)
  const noHoursLeft =
    Boolean(chosenDriver) && (chosenDriver?.hoursLeft === '0:00' || chosenDriver?.hoursLeft === '—')

  /*
   * What this driver is already committed to.
   *
   * Read from the routes already in the provider rather than asked of the
   * database: this dialog is rendered next to the board those routes drew, and
   * a second query could disagree with the list on screen.
   *
   * Cancelled and completed both come back as finished statuses, so neither
   * counts — a called-off route is not a commitment.
   */
  const openRoute = routes.find(
    (row) =>
      row.driverId === values.driverId &&
      row.status !== 'completed' &&
      row.status !== 'cancelled',
  )
  /*
   * A route with no vehicle records nothing. Position reports, duty events and
   * arrivals all attach to the truck, so a route planned against nobody's
   * vehicle is a plan with no way to tell whether it happened.
   */
  const noVehicle = Boolean(values.driverId) && !values.vehicleId

  const concerns: string[] = []
  if (noHoursLeft && chosenDriver) concerns.push(t.routeHoursWarning(chosenDriver.name))
  if (openRoute && chosenDriver)
    concerns.push(t.routeOpenWarning(chosenDriver.name, openRoute.reference))
  if (noVehicle && chosenDriver) concerns.push(t.routeNoVehicleWarning(chosenDriver.name))

  function resolveEnds(): { start: PlacePick; end: PlacePick } | null {
    const start = placeFrom(originId, originOther, depots)
    const end = placeFrom(destinationId, destinationOther, depots)
    const next: typeof errors = {}

    if (start === 'empty') next.origin = d.required
    else if (start === 'needs-location') {
      const name = depots.find((row) => row.id === originId)?.name ?? t.routeFields.origin
      next.origin = t.depotNeedsLocation(name)
    }

    if (end === 'empty') next.destination = d.required
    else if (end === 'needs-location') {
      const name = depots.find((row) => row.id === destinationId)?.name ?? t.routeFields.destination
      next.destination = t.depotNeedsLocation(name)
    }

    if (!values.stops || Number(values.stops) < 2) next.stops = d.required
    if (!values.driverId) next.driverId = d.required
    if (!values.vehicleId) next.vehicleId = d.required
    if (!values.startTime) next.startTime = d.required

    if (
      start !== 'empty' &&
      start !== 'needs-location' &&
      end !== 'empty' &&
      end !== 'needs-location' &&
      start.query.trim().toLowerCase() === end.query.trim().toLowerCase()
    ) {
      next.destination = t.samePlace
    }

    setErrors(next)
    if (Object.keys(next).length > 0) return null
    if (start === 'empty' || start === 'needs-location' || end === 'empty' || end === 'needs-location') {
      return null
    }
    return { start, end }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!resolveEnds()) return

    /*
     * One gate for all of them. Three separate confirmations for one route
     * would be dismissed without being read, which is worse than none.
     */
    if (concerns.length > 0) {
      setConfirmHours(true)
      return
    }

    void commit()
  }

  async function commit() {
    const ends = resolveEnds()
    if (!ends) return

    setSaving(true)
    setSaveError(null)
    let created: Awaited<ReturnType<typeof addRoute>>
    let spacing = ''
    let followedRoad = true
    try {
      const labels = { start: ends.start.label, end: ends.end.label }
      let planned: NewRoute = {
        ...values,
        origin: ends.start.label,
        destination: ends.end.label,
      }
      if (maps) {
        const drive = await planAlongRoute(maps, ends.start, ends.end, Number(values.stops))
        spacing = drive.spacing
        followedRoad = drive.followedRoad
        planned = {
          ...planned,
          plannedDistanceKm: drive.plannedDistanceKm,
          pathPolyline: drive.pathPolyline,
          plannedStops: drive.stops,
        }
      } else {
        planned = {
          ...planned,
          plannedStops: placeholderStops(ends.start.query, ends.end.query, Number(values.stops), labels),
        }
      }
      created = await addRoute(planned)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t.routeFailed)
      return
    } finally {
      setSaving(false)
    }

    if (created && created.distanceKm != null && spacing) {
      show(
        followedRoad
          ? t.routeToastWithKm(created.reference, formatKm(created.distanceKm), spacing)
          : t.routeToastStraight(created.reference, formatKm(created.distanceKm), spacing),
      )
    } else {
      show(created ? t.routeToast(created.reference) : t.routeSaved)
    }
    const made = created
    reset()
    onClose()
    if (made) onCreated?.(made)
  }

  function reset() {
    setValues(EMPTY)
    setOriginId('')
    setDestinationId('')
    setOriginOther('')
    setDestinationOther('')
    setErrors({})
    setConfirmHours(false)
    setSaveError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  return (
    <>
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
            <Button
              type="submit"
              form="plan-route-form"
              loading={saving}
              disabled={Boolean(API_KEY) && !maps}
            >
              {saving && maps ? t.routePlotting : t.routeSubmit}
            </Button>
          </>
        }
      >
        <form id="plan-route-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {saveError && (
            <div role="alert">
              <Alert tone="danger">{saveError}</Alert>
            </div>
          )}
          {!HAS_MAPS_KEY && <Alert tone="neutral">{t.routeNoMap}</Alert>}
          {depots.length === 0 && <Alert tone="neutral">{t.routeNoDepots}</Alert>}
          {/*
            Shown inline as well as in the confirmation, so the dispatcher can
            fix it — pick a truck, pick another driver — before they get as far
            as a modal asking them to override.
          */}
          {noHoursLeft && chosenDriver && (
            <Alert tone="danger">{t.routeHoursWarning(chosenDriver.name)}</Alert>
          )}
          {openRoute && chosenDriver && (
            <Alert tone="warning">
              {t.routeOpenWarning(chosenDriver.name, openRoute.reference)}
            </Alert>
          )}
          {noVehicle && chosenDriver && (
            <Alert tone="warning">{t.routeNoVehicleWarning(chosenDriver.name)}</Alert>
          )}

          <FormGrid>
            <Select
              label={t.routeFields.origin}
              hint={t.originHint}
              options={[{ value: '', label: d.noDepot }, ...depotOptions]}
              value={originId}
              onChange={(event) => {
                setOriginId(event.target.value)
                setErrors((current) => ({ ...current, origin: undefined }))
              }}
              error={errors.origin}
              required
            />
            <Select
              label={t.routeFields.destination}
              hint={t.destinationHint}
              options={[{ value: '', label: d.noDepot }, ...depotOptions]}
              value={destinationId}
              onChange={(event) => {
                setDestinationId(event.target.value)
                setErrors((current) => ({ ...current, destination: undefined }))
              }}
              error={errors.destination}
              required
            />
            {originId === OTHER && (
              <FormRow>
                <Field
                  label={t.routeOtherAddress}
                  placeholder={t.originPlaceholder}
                  value={originOther}
                  onChange={(event) => setOriginOther(event.target.value)}
                  error={errors.origin}
                  autoComplete="off"
                  autoFocus
                />
              </FormRow>
            )}
            {destinationId === OTHER && (
              <FormRow>
                <Field
                  label={t.routeOtherAddress}
                  placeholder={t.destinationPlaceholder}
                  value={destinationOther}
                  onChange={(event) => setDestinationOther(event.target.value)}
                  error={errors.destination}
                  autoComplete="off"
                />
              </FormRow>
            )}
            <Field
              label={t.routeFields.stops}
              type="number"
              min={2}
              hint={t.stopsHint}
              value={values.stops}
              onChange={set('stops')}
              error={errors.stops}
              required
            />
            <Field
              label={t.routeFields.startTime}
              type="time"
              value={values.startTime}
              onChange={set('startTime')}
              error={errors.startTime}
              required
            />
            <Select
              label={t.routeFields.driver}
              hint={t.routePairHint}
              options={driverOptions}
              value={values.driverId}
              onChange={(event) => {
                const driverId = event.target.value
                const picked = drivers.find((driver) => driver.id === driverId)
                setValues((current) => ({
                  ...current,
                  driverId,
                  vehicleId:
                    driverId && !current.vehicleId && picked?.vehicleId
                      ? picked.vehicleId
                      : current.vehicleId,
                }))
              }}
              error={errors.driverId}
              required
            />
            <Select
              label={t.routeFields.vehicle}
              options={vehicleOptions}
              value={values.vehicleId}
              onChange={(event) => {
                const vehicleId = event.target.value
                const picked = vehicles.find((row) => row.id === vehicleId)
                setValues((current) => ({
                  ...current,
                  vehicleId,
                  driverId:
                    vehicleId && !current.driverId && picked?.driverId
                      ? picked.driverId
                      : current.driverId,
                }))
              }}
              error={errors.vehicleId}
              required
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
      <ConfirmDialog
        open={confirmHours}
        onClose={() => setConfirmHours(false)}
        onConfirm={() => void commit()}
        title={noHoursLeft ? t.routeHoursConfirmTitle : t.routeConfirmTitle}
        message={concerns.join(' ')}
        confirmLabel={noHoursLeft ? t.routeHoursConfirm : t.routeConfirmSubmit}
        // Out of hours is a legal problem; the other two are planning ones.
        tone={noHoursLeft ? 'danger' : 'warning'}
      />
    </>
  )
}
