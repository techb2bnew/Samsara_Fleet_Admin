import { useEffect, useState, type FormEvent } from 'react'
import { STRINGS } from '../../../constants'
import { Alert, Badge, Button, Field, FormGrid, Modal, Select, Textarea, useToast } from '../../../components/ui'
import { useFleetData } from '../../fleet-data'
import {
  DEFECT_LABEL,
  DEFECT_STATUS_LABEL,
  DEFECT_STATUS_TONE,
  DEFECT_TONE,
  type InspectionDefect,
} from '../types'

const t = STRINGS.inspections.defectActions

/**
 * One defect, with what the office can do about it.
 *
 * Two actions, and they are not the same thing:
 *
 *   Raise a work order   the truck needs a repair, so open the job
 *   Close it             it was fixed, or it was looked at and needed nothing
 *
 * A driver reports the defect; only the office can open the repair. That split
 * is in the schema, not just here — work_orders.opened_by points at users, and
 * row-level security limits writes to fleet_admin and mechanic.
 */
export function DefectRow({
  defect,
  vehicleName,
}: {
  defect: InspectionDefect
  /** Which vehicle the repair would be against. */
  vehicleName: string
}) {
  const { vehicles, workOrders } = useFleetData()
  const [raising, setRaising] = useState(false)
  const [closing, setClosing] = useState(false)

  const open = defect.status === 'open' || defect.status === 'in_repair'
  const vehicle = vehicles.find((v) => v.name === vehicleName)
  const workOrder = defect.workOrderId
    ? workOrders.find((w) => w.id === defect.workOrderId)
    : undefined

  return (
    <li className="flex flex-col gap-2.5 px-5 py-3.5 sm:flex-row sm:items-start sm:gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-medium text-ink">{defect.area}</p>
        <p className="mt-0.5 text-[12.5px] text-ink-3">{defect.finding}</p>
        <p className="mt-0.5 text-[12px] text-ink-4">
          {defect.reportedByName
            ? t.reportedBy(defect.reportedByName, defect.reportedAt)
            : t.reportedAt(defect.reportedAt)}
        </p>
        {defect.correctiveAction && (
          <p className="mt-1 text-[12px] text-ink-3">
            {t.actionTaken}: {defect.correctiveAction}
          </p>
        )}
        {workOrder && (
          <p className="mt-1 font-mono text-[11.5px] text-ink-4">{t.onWorkOrder(workOrder.reference)}</p>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        <Badge tone={DEFECT_STATUS_TONE[defect.status]}>{DEFECT_STATUS_LABEL[defect.status]}</Badge>
        {/* Severity stays visible after a fix: how bad it was is part of the
            record an audit reads. */}
        <Badge tone={open ? DEFECT_TONE[defect.severity] : 'neutral'}>
          {DEFECT_LABEL[defect.severity]}
        </Badge>
        {open && (
          <>
            {/* Only offered once, and only when the vehicle is known — the
                work order has to hang off a vehicle row. */}
            {!defect.workOrderId && vehicle && (
              <Button size="sm" variant="secondary" onClick={() => setRaising(true)}>
                {t.raise}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setClosing(true)}>
              {t.close}
            </Button>
          </>
        )}
      </div>

      {vehicle && (
        <RaiseWorkOrderDialog
          open={raising}
          onClose={() => setRaising(false)}
          defect={defect}
          vehicleId={vehicle.id}
          vehicleName={vehicleName}
        />
      )}
      <CloseDefectDialog open={closing} onClose={() => setClosing(false)} defect={defect} />
    </li>
  )
}

/* ------------------------------------------------------------ work order */

function RaiseWorkOrderDialog({
  open,
  onClose,
  defect,
  vehicleId,
  vehicleName,
}: {
  open: boolean
  onClose: () => void
  defect: InspectionDefect
  vehicleId: string
  vehicleName: string
}) {
  const { addWorkOrder } = useFleetData()
  const { show } = useToast()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  /*
   * Prefilled from the defect, and editable. The office knows the job by what
   * has to be done ("replace front brake pads"), not by what the driver saw
   * ("brakes feel soft") — but the driver's words are the starting point and
   * retyping them is how detail gets lost.
   */
  useEffect(() => {
    if (!open) return
    setTitle(`${defect.area} — ${defect.finding}`.slice(0, 120))
    setDescription('')
    setError(null)
  }, [open, defect.area, defect.finding])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) {
      setError(STRINGS.dialog.required)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await addWorkOrder({ vehicleId, title, description, defectId: defect.id })
      show(t.raisedToast(vehicleName))
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.raiseFailed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.raiseTitle}
      description={t.raiseDescription(vehicleName)}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {STRINGS.common.cancel}
          </Button>
          <Button type="submit" form={`raise-${defect.id}`} loading={saving}>
            {t.raiseSubmit}
          </Button>
        </>
      }
    >
      <form id={`raise-${defect.id}`} onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="mb-4">
            <Alert tone="danger">{error}</Alert>
          </div>
        )}
        <FormGrid>
          <Field label={t.jobTitle} value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea
            label={t.jobNotes}
            hint={t.jobNotesHint}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </FormGrid>
      </form>
    </Modal>
  )
}

/* ---------------------------------------------------------- closing it */

function CloseDefectDialog({
  open,
  onClose,
  defect,
}: {
  open: boolean
  onClose: () => void
  defect: InspectionDefect
}) {
  const { resolveDefect } = useFleetData()
  const { show } = useToast()

  const [outcome, setOutcome] = useState<'resolved' | 'dismissed'>('resolved')
  const [action, setAction] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setOutcome('resolved')
    setAction('')
    setError(null)
  }, [open])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    /*
     * A dismissal has to be justified. "Somebody decided this brake report
     * needed nothing" is exactly the entry an inspector stops on, and an empty
     * reason there is worse than no record at all.
     */
    if (outcome === 'dismissed' && !action.trim()) {
      setError(t.reasonRequired)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await resolveDefect(defect.id, outcome, action)
      show(outcome === 'resolved' ? t.resolvedToast : t.dismissedToast)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.closeFailed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.closeTitle}
      description={t.closeDescription}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {STRINGS.common.cancel}
          </Button>
          <Button type="submit" form={`close-${defect.id}`} loading={saving}>
            {t.closeSubmit}
          </Button>
        </>
      }
    >
      <form id={`close-${defect.id}`} onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="mb-4">
            <Alert tone="danger">{error}</Alert>
          </div>
        )}
        <FormGrid>
          <Select
            label={t.outcome}
            options={[
              { value: 'resolved', label: t.outcomeResolved },
              { value: 'dismissed', label: t.outcomeDismissed },
            ]}
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as 'resolved' | 'dismissed')}
          />
          <Textarea
            label={outcome === 'resolved' ? t.whatWasDone : t.whyDismissed}
            hint={outcome === 'resolved' ? t.whatWasDoneHint : undefined}
            rows={3}
            value={action}
            onChange={(e) => setAction(e.target.value)}
          />
        </FormGrid>
      </form>
    </Modal>
  )
}
