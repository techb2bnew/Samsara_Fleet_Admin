import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { STRINGS } from '../../../constants'
import { DetailList, DetailRow, DetailShell } from '../../../components/layout/DetailShell'
import { Panel } from '../../../components/layout/PageShell'
import { Alert, Badge, Button, ConfirmDialog, EmptyState, useToast } from '../../../components/ui'
import { useFleetData } from '../../fleet-data'
import { WORK_ORDER_LABEL, WORK_ORDER_TONE, type WorkOrder } from '../types'
import { hrefForVehicleName } from '../../../lib/entityLinks'

const t = STRINGS.vehicles
const d = t.woDetail

/**
 * One repair job.
 *
 * This page used to be a dead end. It listed seven fields and offered one
 * link, so a request a driver raised from the app arrived with its title
 * visible, whatever they had written invisible, and no way at all to move it
 * on — setWorkOrderStatus existed in the api and in the provider, and no
 * screen anywhere called it.
 */

type Move = { to: WorkOrder['status']; label: string }

/**
 * Where a job can go from where it is, and what the button says.
 *
 * The label belongs to the MOVE, not to the destination. It was keyed on the
 * destination alone, so a completed job offered "Start work" — the only way
 * out of completed is back to in_progress, and from there that button reads as
 * though the job had never been done.
 *
 * Both endings can be reopened. A job marked done that turns out not to be has
 * to go somewhere, and the alternative — raising a second work order for the
 * same fault — is how one repair becomes two records nobody can reconcile.
 */
const NEXT: Record<WorkOrder['status'], Move[]> = {
  open: [
    { to: 'assigned', label: d.assign },
    { to: 'in_progress', label: d.start },
    { to: 'cancelled', label: d.cancel },
  ],
  assigned: [
    { to: 'in_progress', label: d.start },
    { to: 'completed', label: d.complete },
    { to: 'cancelled', label: d.cancel },
  ],
  in_progress: [
    { to: 'completed', label: d.complete },
    { to: 'cancelled', label: d.cancel },
  ],
  completed: [{ to: 'in_progress', label: d.reopen }],
  cancelled: [{ to: 'open', label: d.reopen }],
}

export function WorkOrderDetailPage() {
  const { workOrderId } = useParams()
  const { vehicles, workOrders, setWorkOrderStatus } = useFleetData()
  const { show } = useToast()

  const [saving, setSaving] = useState<WorkOrder['status'] | null>(null)
  const [error, setError] = useState<string | null>(null)
  /* Only the two that are hard to walk back get a confirmation. */
  const [confirming, setConfirming] = useState<'completed' | 'cancelled' | null>(null)

  const order = workOrders.find((w) => w.id === workOrderId)

  if (!order) {
    return (
      <DetailShell backTo="/vehicles" backLabel={t.woBack} title={t.woNotFound}>
        <Panel>
          <EmptyState title={t.woNotFound} />
        </Panel>
      </DetailShell>
    )
  }

  async function move(status: WorkOrder['status']) {
    if (!order) return
    setSaving(status)
    setError(null)
    try {
      await setWorkOrderStatus(order.id, status)
      show(d.statusToast(WORK_ORDER_LABEL[status]))
      setConfirming(null)
    } catch (cause) {
      setConfirming(null)
      setError(cause instanceof Error ? cause.message : d.statusFailed)
    } finally {
      setSaving(null)
    }
  }

  return (
    <DetailShell
      backTo="/vehicles"
      backLabel={t.woBack}
      title={order.reference}
      subtitle={order.title}
      badge={<Badge tone={WORK_ORDER_TONE[order.status]}>{WORK_ORDER_LABEL[order.status]}</Badge>}
      actions={
        <Link to={hrefForVehicleName(vehicles, order.vehicle)}>
          <Button size="sm" variant="secondary">
            {d.openVehicle}
          </Button>
        </Link>
      }
    >
      {error && (
        <div className="mb-5" role="alert">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,360px)_1fr]">
        <div className="grid gap-5">
          <Panel title={d.about}>
            <DetailList>
              <DetailRow label={d.reference}>
                <span className="font-mono">{order.reference}</span>
              </DetailRow>
              <DetailRow label={d.vehicle}>{order.vehicle}</DetailRow>
              <DetailRow label={d.job}>{order.title}</DetailRow>
              <DetailRow label={d.status}>
                <Badge tone={WORK_ORDER_TONE[order.status]}>
                  {WORK_ORDER_LABEL[order.status]}
                </Badge>
              </DetailRow>
              {/* Who asked. opened_by cannot answer this — it references
                  users, and a driver has no row there. */}
              <DetailRow label={d.raisedBy}>
                {order.requestedByDriverName ? (
                  <span className="font-medium text-accent">{order.requestedByDriverName}</span>
                ) : (
                  <span className="text-ink-3">{d.byOffice}</span>
                )}
              </DetailRow>
              <DetailRow label={d.mechanic}>
                {order.mechanic ?? <span className="text-ink-4">{t.unassigned}</span>}
              </DetailRow>
              <DetailRow label={d.opened}>{order.opened}</DetailRow>
              {order.completed && <DetailRow label={d.completed}>{order.completed}</DetailRow>}
              <DetailRow label={d.cost}>
                {order.costRupees > 0 ? (
                  <span className="font-mono">₹{order.costRupees.toLocaleString()}</span>
                ) : (
                  <span className="text-ink-4">—</span>
                )}
              </DetailRow>
            </DetailList>
          </Panel>

          <Panel title={d.actions}>
            <div className="flex flex-wrap gap-2 px-4 py-4 sm:px-5">
              {NEXT[order.status].map((step) => {
                return (
                  <Button
                    key={step.to}
                    size="sm"
                    variant={step.to === 'cancelled' ? 'ghost' : 'secondary'}
                    loading={saving === step.to}
                    onClick={() => {
                      if (step.to === 'completed' || step.to === 'cancelled') {
                        setConfirming(step.to)
                      } else {
                        void move(step.to)
                      }
                    }}
                  >
                    {step.label}
                  </Button>
                )
              })}
            </div>
          </Panel>
        </div>

        <div className="grid gap-5">
          <Panel title={d.details}>
            <div className="px-4 py-4 text-[13.5px] sm:px-5">
              {order.description ? (
                <p className="whitespace-pre-wrap text-ink">{order.description}</p>
              ) : (
                <p className="text-ink-3">{d.noDetails}</p>
              )}
            </div>
          </Panel>

          <Panel title={d.faults}>
            {order.defects.length === 0 ? (
              <div className="px-4 py-4 text-[13.5px] text-ink-3 sm:px-5">{d.noFaults}</div>
            ) : (
              <ul className="divide-y divide-line">
                {order.defects.map((defect) => (
                  <li key={defect.id} className="px-4 py-3.5 sm:px-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-medium text-ink">{defect.area}</p>
                        <p className="mt-0.5 text-[12.5px] text-ink-3">{defect.finding}</p>
                      </div>
                      <Badge tone={defect.severity === 'out_of_service' ? 'danger' : 'warning'}>
                        {d.severity[defect.severity as keyof typeof d.severity] ?? defect.severity}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        onConfirm={() => void move(confirming ?? 'completed')}
        title={confirming === 'cancelled' ? d.confirmCancelTitle : d.confirmCompleteTitle}
        message={confirming === 'cancelled' ? d.confirmCancelMessage : d.confirmCompleteMessage}
        confirmLabel={confirming === 'cancelled' ? d.cancel : d.complete}
        tone={confirming === 'cancelled' ? 'danger' : 'primary'}
      />
    </DetailShell>
  )
}
