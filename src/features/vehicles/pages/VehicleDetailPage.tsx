import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { STRINGS } from '../../../constants'
import { DetailList, DetailRow, DetailShell } from '../../../components/layout/DetailShell'
import { Panel } from '../../../components/layout/PageShell'
import { Badge, Button, EmptyState } from '../../../components/ui'
import { useFleetData } from '../../fleet-data'
import { AssignDriverDialog } from '../components/AssignDriverDialog'
import { AddVehicleDialog } from '../components/AddVehicleDialog'
import { ComplianceDocuments } from '../../documents/components/ComplianceDocuments'
import {
  VEHICLE_STATUS_LABEL,
  VEHICLE_STATUS_TONE,
  WORK_ORDER_LABEL,
  WORK_ORDER_TONE,
} from '../types'
import { hrefForDriverName } from '../../../lib/entityLinks'

const t = STRINGS.vehicles

export function VehicleDetailPage() {
  const { vehicleId } = useParams()
  const { vehicles, drivers, workOrders, inspections } = useFleetData()
  const [assigning, setAssigning] = useState(false)
  const [editing, setEditing] = useState(false)

  const vehicle = vehicles.find((v) => v.id === vehicleId)

  if (!vehicle) {
    return (
      <DetailShell backTo="/vehicles" backLabel={t.back} title={t.notFound}>
        <Panel>
          <EmptyState title={t.notFound} />
        </Panel>
      </DetailShell>
    )
  }

  const openWorkOrders = workOrders.filter(
    (w) => w.vehicle === vehicle.name && w.status !== 'completed',
  )
  const vehicleInspections = inspections.filter((i) => i.vehicle === vehicle.name)

  return (
    <DetailShell
      backTo="/vehicles"
      backLabel={t.back}
      title={vehicle.name}
      subtitle={vehicle.plate}
      badge={
        <Badge tone={VEHICLE_STATUS_TONE[vehicle.status]}>
          {VEHICLE_STATUS_LABEL[vehicle.status]}
        </Badge>
      }
      actions={
        <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
          {t.detail.edit}
        </Button>
      }
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title={t.detail.identity}>
          <DetailList>
            <DetailRow label={t.detail.plate}>
              <span className="font-mono">{vehicle.plate}</span>
            </DetailRow>
            <DetailRow label={t.detail.vin}>
              {vehicle.vin ? (
                <span className="font-mono">{vehicle.vin}</span>
              ) : (
                <span className="text-ink-4">—</span>
              )}
            </DetailRow>
            <DetailRow label={t.detail.makeModel}>{vehicle.makeModel}</DetailRow>
            <DetailRow label={t.detail.year}>
              {vehicle.year ?? <span className="text-ink-4">—</span>}
            </DetailRow>
            <DetailRow label={t.detail.kind}>
              {vehicle.kind === 'trailer' ? t.kindTrailer : t.kindTruck}
            </DetailRow>
            <DetailRow label={t.detail.depot}>
              {vehicle.depot?.name ?? <span className="text-ink-4">—</span>}
            </DetailRow>
          </DetailList>
        </Panel>

        <Panel
          title={t.detail.condition}
          action={
            // A trailer has no driver of its own — it is towed by one that has.
            vehicle.kind === 'trailer' ? undefined : (
              <Button size="sm" variant="secondary" onClick={() => setAssigning(true)}>
                {vehicle.driver ? t.detail.changeDriver : t.detail.assignDriver}
              </Button>
            )
          }
        >
          {vehicle.kind === 'trailer' ? (
            <EmptyState title={t.detail.trailerCondition} hint={t.detail.trailerConditionHint} />
          ) : (
          <DetailList>
            <DetailRow label={t.detail.driver}>
              {vehicle.driver ? (
                <Link to={hrefForDriverName(drivers, vehicle.driver)} className="text-accent hover:underline">
                  {vehicle.driver}
                </Link>
              ) : (
                <span className="text-ink-4">{t.unassigned}</span>
              )}
            </DetailRow>
            <DetailRow label={t.detail.odometer}>
              <span className="font-mono">{vehicle.odometerKm.toLocaleString()} km</span>
            </DetailRow>
            <DetailRow label={t.detail.nextService}>
              {vehicle.nextServiceKm === null ? (
                <span className="text-ink-3">{t.detail.noSchedule}</span>
              ) : vehicle.serviceOverdueKm > 0 ? (
                <span className="font-medium text-warn">{t.overdueBy(vehicle.serviceOverdueKm)}</span>
              ) : (
                t.dueIn(vehicle.nextServiceKm - vehicle.odometerKm)
              )}
            </DetailRow>
          </DetailList>
          )}
        </Panel>

        <Panel title={t.detail.openWorkOrders}>
          {openWorkOrders.length === 0 ? (
            <EmptyState title={t.detail.noWorkOrders} />
          ) : (
            <ul className="divide-y divide-line">
              {openWorkOrders.map((w) => (
                <li key={w.id}>
                  <Link
                    to={`/work-orders/${w.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium text-ink">{w.title}</p>
                      <p className="font-mono text-[12px] text-ink-3">
                        {w.reference} · {w.opened}
                      </p>
                    </div>
                    <Badge tone={WORK_ORDER_TONE[w.status]}>{WORK_ORDER_LABEL[w.status]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <ComplianceDocuments owner={{ vehicleId: vehicle.id, name: vehicle.name }} />

        <Panel title={t.detail.recentInspections}>
          {vehicleInspections.length === 0 ? (
            <EmptyState title={t.detail.noInspections} />
          ) : (
            <ul className="divide-y divide-line">
              {vehicleInspections.map((i) => (
                <li key={i.id}>
                  <Link
                    to={`/inspections/${i.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium text-ink">
                        {i.type} · {i.driver}
                      </p>
                      <p className="text-[12.5px] text-ink-3">{i.submitted}</p>
                    </div>
                    <Badge tone={i.defects > 0 ? 'danger' : 'success'}>
                      {i.defects > 0 ? `${i.defects} defects` : 'Clear'}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {vehicle.kind === 'truck' && (
        <AssignDriverDialog
          open={assigning}
          vehicle={vehicle}
          onClose={() => setAssigning(false)}
        />
      )}
      <AddVehicleDialog open={editing} vehicle={vehicle} onClose={() => setEditing(false)} />
    </DetailShell>
  )
}
