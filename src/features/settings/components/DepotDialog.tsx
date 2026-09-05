import { useEffect, useState, type FormEvent } from 'react'
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps'
import { STRINGS } from '../../../constants'
import { Alert, Button, Field, Modal, Select, useToast } from '../../../components/ui'
import { useFleetData, type NewDepot } from '../../fleet-data'
import type { DepotRow } from '../../../supabase/api'

const t = STRINGS.settings.depotDialog
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()

/**
 * The timezones on offer.
 *
 * A short list, not every IANA zone: this decides where a driver's legal day
 * starts and ends, and a searchable list of 600 is a worse way to get that
 * right than a dozen the operator recognises. Add one when a customer needs it.
 */
const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'India — Kolkata' },
  { value: 'Asia/Dubai', label: 'UAE — Dubai' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Europe/London', label: 'United Kingdom — London' },
  { value: 'Europe/Amsterdam', label: 'Netherlands — Amsterdam' },
  { value: 'Europe/Warsaw', label: 'Poland — Warsaw' },
  { value: 'America/New_York', label: 'US — Eastern' },
  { value: 'America/Chicago', label: 'US — Central' },
  { value: 'America/Denver', label: 'US — Mountain' },
  { value: 'America/Los_Angeles', label: 'US — Pacific' },
  { value: 'Australia/Sydney', label: 'Australia — Sydney' },
  { value: 'UTC', label: 'UTC' },
]

const EMPTY: NewDepot = {
  name: '',
  code: '',
  timezone: 'UTC',
  address: '',
  latitude: null,
  longitude: null,
}

/**
 * Adds a depot, or edits one.
 *
 * Renaming is safe. It was not before — drivers were linked to their depot by
 * name, so a rename detached every driver in it. They hold the depot's id now.
 *
 * The address is what a route uses as a start or end. Without it, "from this
 * depot to that depot" is two names and no geography.
 */
export function DepotDialog({
  open,
  depot,
  onClose,
  onCreated,
  stacked = false,
}: {
  open: boolean
  depot: DepotRow | null
  onClose: () => void
  onCreated?: (id: string) => void
  stacked?: boolean
}) {
  if (!open) return null
  if (!API_KEY) {
    return (
      <DepotForm
        open
        depot={depot}
        onClose={onClose}
        onCreated={onCreated}
        stacked={stacked}
        maps={null}
      />
    )
  }

  return (
    <APIProvider apiKey={API_KEY}>
      <DepotMapsBridge
        depot={depot}
        onClose={onClose}
        onCreated={onCreated}
        stacked={stacked}
      />
    </APIProvider>
  )
}

function DepotMapsBridge({
  depot,
  onClose,
  onCreated,
  stacked,
}: {
  depot: DepotRow | null
  onClose: () => void
  onCreated?: (id: string) => void
  stacked: boolean
}) {
  const maps = useMapsLibrary('maps')
  const geocoding = useMapsLibrary('geocoding')
  const ready = maps && geocoding ? google.maps : null
  return (
    <DepotForm
      open
      depot={depot}
      onClose={onClose}
      onCreated={onCreated}
      stacked={stacked}
      maps={ready}
    />
  )
}

function DepotForm({
  open,
  depot,
  onClose,
  onCreated,
  stacked,
  maps,
}: {
  open: boolean
  depot: DepotRow | null
  onClose: () => void
  onCreated?: (id: string) => void
  stacked: boolean
  maps: typeof google.maps | null
}) {
  const { addDepot, saveDepot, org } = useFleetData()
  const { show } = useToast()

  const [values, setValues] = useState<NewDepot>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof NewDepot, string>>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setValues(
      depot
        ? {
            name: depot.name,
            code: depot.code ?? '',
            timezone: depot.timezone,
            address: depot.address,
            latitude: depot.latitude,
            longitude: depot.longitude,
          }
        : { ...EMPTY, timezone: org.timezone || 'UTC' },
    )
    setErrors({})
    setSaveError(null)
  }, [open, depot, org.timezone])

  const set = (key: keyof NewDepot) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }))

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const next: typeof errors = {}
    if (!values.name.trim()) next.name = STRINGS.dialog.required
    if (!values.address.trim()) next.address = STRINGS.dialog.required
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSaving(true)
    setSaveError(null)
    try {
      const located = await resolveAddress(maps, values.address.trim())
      const payload: NewDepot = {
        ...values,
        latitude: located.lat,
        longitude: located.lng,
        address: located.formatted,
      }
      if (depot) {
        await saveDepot(depot.id, payload)
        show(t.savedToast(values.name.trim()))
      } else {
        const id = await addDepot(payload)
        show(t.addedToast(values.name.trim()))
        onCreated?.(id)
      }
      onClose()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t.failed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={depot ? t.editTitle : t.addTitle}
      description={depot ? t.description : t.addDescription}
      size="sm"
      stacked={stacked}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {STRINGS.common.cancel}
          </Button>
          <Button type="submit" form="depot-form" loading={saving}>
            {depot ? t.save : t.add}
          </Button>
        </>
      }
    >
      <form id="depot-form" onSubmit={handleSubmit} noValidate>
        {saveError && (
          <div className="mb-4">
            <Alert tone="danger">{saveError}</Alert>
          </div>
        )}
        <div className="flex flex-col gap-5">
          <Field
            label={t.fields.name}
            placeholder={t.namePlaceholder}
            value={values.name}
            onChange={set('name')}
            error={errors.name}
            autoComplete="off"
            autoFocus
          />
          <Field
            label={t.fields.address}
            placeholder={t.addressPlaceholder}
            hint={t.addressHint}
            value={values.address}
            onChange={set('address')}
            error={errors.address}
            autoComplete="street-address"
          />
          <div className="grid items-start gap-x-4 gap-y-5 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <Field
              label={t.fields.code}
              trailing={
                <span className="text-[12px] font-normal text-ink-4">{STRINGS.common.optional}</span>
              }
              placeholder={t.codePlaceholder}
              value={values.code}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  code: event.target.value.toUpperCase().replace(/\s/g, '').slice(0, 8),
                }))
              }
              maxLength={8}
              autoComplete="off"
              spellCheck={false}
              className="font-mono uppercase tracking-[0.08em]"
            />
            <Select
              label={t.fields.timezone}
              hint={t.timezoneHint}
              options={TIMEZONES}
              value={values.timezone}
              onChange={set('timezone')}
            />
          </div>
        </div>
      </form>
    </Modal>
  )
}

async function resolveAddress(
  maps: typeof google.maps | null,
  address: string,
): Promise<{ lat: number | null; lng: number | null; formatted: string }> {
  if (!maps) return { lat: null, lng: null, formatted: address }
  try {
    const res = await new maps.Geocoder().geocode({ address })
    const best = res.results[0]
    const loc = best?.geometry?.location
    return {
      lat: loc ? loc.lat() : null,
      lng: loc ? loc.lng() : null,
      formatted: best?.formatted_address || address,
    }
  } catch {
    return { lat: null, lng: null, formatted: address }
  }
}
