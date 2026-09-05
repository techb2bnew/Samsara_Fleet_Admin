import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { STRINGS } from '../../../constants'
import { Alert, Button, Field, FormGrid, FormRow, Modal, Select, useToast } from '../../../components/ui'
import { useFleetData, type NewVehicle } from '../../fleet-data'
import { DepotSelect } from '../../settings/components/DepotSelect'
import { UploadDocumentDialog } from '../../documents/components/UploadDocumentDialog'
import { VEHICLE_STATUS_LABEL, type Vehicle, type VehicleStatus } from '../types'

const t = STRINGS.forms_common
const d = STRINGS.dialog

/** Matches the interval written with the vehicle. Shown as the default next due. */
const SERVICE_EVERY_KM = 20_000

const EMPTY: NewVehicle = {
  name: '',
  plate: '',
  vin: '',
  makeModel: '',
  year: '',
  depotId: '',
  odometerKm: '',
  nextServiceKm: String(SERVICE_EVERY_KM),
  status: 'active',
  driverId: '',
}

function defaultNextService(odometerKm: string): string {
  return String((Number(odometerKm) || 0) + SERVICE_EVERY_KM)
}

function fromVehicle(vehicle: Vehicle): NewVehicle {
  return {
    name: vehicle.name,
    plate: vehicle.plate,
    vin: vehicle.vin ?? '',
    makeModel: vehicle.makeModel === '—' ? '' : vehicle.makeModel,
    year: vehicle.year ? String(vehicle.year) : '',
    depotId: vehicle.depot?.id ?? '',
    odometerKm: vehicle.odometerKm ? String(vehicle.odometerKm) : '',
    nextServiceKm:
      vehicle.nextServiceKm != null
        ? String(Math.round(vehicle.nextServiceKm))
        : defaultNextService(String(vehicle.odometerKm)),
    status: vehicle.status,
    driverId: vehicle.driverId ?? '',
  }
}

/**
 * Adds a vehicle, or edits one already on the fleet.
 *
 * VIN is optional. When it is filled it must be 17 characters — that is what
 * sits on the chassis plate, and a short or padded value is almost always a
 * mistype of a number that has to match a physical truck.
 *
 * Next service is the odometer reading at which the next job is due. It is
 * written as a distance schedule so the list column has a real number, not a
 * dash that looked like "nobody set this" after add.
 */
export function AddVehicleDialog({
  open,
  vehicle = null,
  onClose,
}: {
  open: boolean
  vehicle?: Vehicle | null
  onClose: () => void
}) {
  const { addVehicle, saveVehicle, drivers, vehicles } = useFleetData()
  const { show } = useToast()
  const editing = vehicle !== null

  const [values, setValues] = useState<NewVehicle>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof NewVehicle, string>>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const nextServiceEdited = useRef(false)
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [docsFiled, setDocsFiled] = useState(0)

  useEffect(() => {
    if (!open) return
    setValues(vehicle ? fromVehicle(vehicle) : EMPTY)
    setErrors({})
    setSaveError(null)
    nextServiceEdited.current = false
    setCreated(null)
    setUploadingDoc(false)
    setDocsFiled(0)
  }, [open, vehicle])

  const set = (key: keyof NewVehicle) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }))

  function setOdometer(event: { target: { value: string } }) {
    const odometerKm = event.target.value
    setValues((current) => ({
      ...current,
      odometerKm,
      nextServiceKm:
        editing || nextServiceEdited.current ? current.nextServiceKm : defaultNextService(odometerKm),
    }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const next: typeof errors = {}
    if (!values.name.trim()) next.name = d.required
    if (!values.plate.trim()) next.plate = d.required
    if (!values.makeModel.trim()) next.makeModel = d.required
    if (!values.depotId) next.depotId = d.required
    if (!values.odometerKm.trim()) next.odometerKm = d.required
    const vin = values.vin.toUpperCase().replace(/[\s-]/g, '')
    if (vin && vin.length !== 17) next.vin = t.vehicleFields.vinInvalid
    const nextKm = Number(values.nextServiceKm)
    if (!values.nextServiceKm.trim() || !Number.isFinite(nextKm) || nextKm <= 0) {
      next.nextServiceKm = t.vehicleFields.nextServiceInvalid
    }

    setErrors(next)
    if (Object.keys(next).length > 0) return

    const payload = { ...values, vin }
    setSaving(true)
    setSaveError(null)
    try {
      if (vehicle) {
        await saveVehicle(vehicle.id, payload)
        show(t.editVehicleToast(values.name.trim()))
        onClose()
        return
      }
      const id = await addVehicle(payload)
      show(t.addVehicleToast(values.name.trim()))
      setCreated({ id, name: values.name.trim() })
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t.addVehicleFailed)
      return
    } finally {
      setSaving(false)
    }
  }

  const statusOptions = (Object.keys(VEHICLE_STATUS_LABEL) as VehicleStatus[]).map((key) => ({
    value: key,
    label: VEHICLE_STATUS_LABEL[key],
  }))

  const driverOptions = useMemo(() => {
    const eligible = drivers.filter((driver) => driver.employment === 'active' && !driver.licenceExpired)
    const atDepot = values.depotId
      ? eligible.filter((driver) => driver.depot?.id === values.depotId)
      : eligible
    const listed = values.depotId && atDepot.length > 0 ? atDepot : eligible
    const heldBy = new Map<string, string>()
    for (const other of vehicles) {
      if (other.id === vehicle?.id || !other.driverId) continue
      heldBy.set(other.driverId, other.name)
    }
    return [
      { value: '', label: t.vehicleFields.noDriver },
      ...listed.map((driver) => {
        const holding = heldBy.get(driver.id)
        return {
          value: driver.id,
          label: holding ? STRINGS.vehicles.assignDialog.currentlyOn(driver.name, holding) : driver.name,
        }
      }),
    ]
  }, [drivers, vehicles, values.depotId, vehicle?.id])

  if (created) {
    return (
      <>
        <Modal
          open={open}
          onClose={onClose}
          title={t.addVehicleDocsTitle(created.name)}
          description={t.addVehicleDocsDescription}
          footer={
            <Button onClick={onClose}>{t.addVehicleDocsDone}</Button>
          }
        >
          <div className="flex flex-col gap-4">
            {docsFiled > 0 && <Alert tone="success">{t.addVehicleDocsCount(docsFiled)}</Alert>}
            <Button variant="secondary" onClick={() => setUploadingDoc(true)}>
              {t.addVehicleDocsUpload}
            </Button>
          </div>
        </Modal>
        <UploadDocumentDialog
          open={uploadingDoc}
          stacked
          owner={{ vehicleId: created.id, name: created.name }}
          onClose={() => setUploadingDoc(false)}
          onUploaded={() => {
            setDocsFiled((n) => n + 1)
            setUploadingDoc(false)
          }}
        />
      </>
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? t.editVehicleTitle : t.addVehicleTitle}
      description={editing ? t.editVehicleDescription : t.addVehicleDescription}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {d.cancel}
          </Button>
          <Button type="submit" form="vehicle-form" loading={saving}>
            {editing ? t.editVehicleSubmit : t.addVehicleSubmit}
          </Button>
        </>
      }
    >
      <form id="vehicle-form" onSubmit={handleSubmit} noValidate>
        {saveError && (
          <div className="mb-4" role="alert">
            <Alert tone="danger">{saveError}</Alert>
          </div>
        )}
        <FormGrid>
          <Field
            label={t.vehicleFields.name}
            placeholder={t.vehicleFields.namePlaceholder}
            value={values.name}
            onChange={set('name')}
            error={errors.name}
            required
            autoFocus
          />
          <Field
            label={t.vehicleFields.plate}
            placeholder={t.vehicleFields.platePlaceholder}
            value={values.plate}
            onChange={set('plate')}
            error={errors.plate}
            required
            className="font-mono tracking-[0.04em] uppercase"
          />
          <FormRow>
            <Field
              label={t.vehicleFields.vin}
              placeholder={t.vehicleFields.vinPlaceholder}
              hint={t.vehicleFields.vinHint}
              trailing={
                <span className="font-mono text-[12px] font-normal tabular-nums text-ink-4">
                  {values.vin.length}/17
                </span>
              }
              value={values.vin}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  vin: event.target.value.toUpperCase().replace(/[\s-]/g, '').slice(0, 17),
                }))
              }
              error={errors.vin}
              autoComplete="off"
              spellCheck={false}
              className="font-mono tracking-[0.12em]"
              maxLength={17}
            />
          </FormRow>
          <Field
            label={t.vehicleFields.makeModel}
            placeholder={t.vehicleFields.makeModelPlaceholder}
            value={values.makeModel}
            onChange={set('makeModel')}
            error={errors.makeModel}
            required
          />
          <Field
            label={t.vehicleFields.year}
            type="number"
            placeholder="2024"
            value={values.year}
            onChange={set('year')}
          />
          <DepotSelect
            label={t.vehicleFields.depot}
            emptyLabel={d.noDepot}
            value={values.depotId}
            onChange={(depotId) =>
              setValues((current) => {
                const stillListed =
                  !depotId ||
                  drivers.some(
                    (driver) =>
                      driver.id === current.driverId &&
                      driver.depot?.id === depotId,
                  )
                return { ...current, depotId, driverId: stillListed ? current.driverId : '' }
              })
            }
            required
            error={errors.depotId}
          />
          <Select
            label={t.vehicleFields.driver}
            hint={t.vehicleFields.driverHint}
            options={driverOptions}
            value={values.driverId}
            onChange={set('driverId')}
          />
          <Select
            label={t.vehicleFields.status}
            options={statusOptions}
            value={values.status}
            onChange={set('status')}
          />
          <Field
            label={t.vehicleFields.odometer}
            type="number"
            placeholder="0"
            value={values.odometerKm}
            onChange={setOdometer}
            error={errors.odometerKm}
            required
            min={0}
          />
          <Field
            label={t.vehicleFields.nextService}
            type="number"
            placeholder={String(SERVICE_EVERY_KM)}
            value={values.nextServiceKm}
            onChange={(event) => {
              nextServiceEdited.current = true
              set('nextServiceKm')(event)
            }}
            error={errors.nextServiceKm}
            required
            hint={editing ? undefined : t.vehicleFields.nextServiceHint}
            min={1}
          />
        </FormGrid>
      </form>
    </Modal>
  )
}
