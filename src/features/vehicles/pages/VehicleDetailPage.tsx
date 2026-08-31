import { useParams } from 'react-router-dom'
import { STRINGS } from '../../../constants'
import { DetailList, DetailRow, DetailShell } from '../../../components/layout/DetailShell'
import { Panel } from '../../../components/layout/PageShell'
import { Badge, EmptyState } from '../../../components/ui'
import { useFleetData } from '../../fleet-data'
import {
  MOCK_WORK_ORDERS,
  VEHICLE_STATUS_LABEL,
  VEHICLE_STATUS_TONE,
  WORK_ORDER_LABEL,
  WORK_ORDER_TONE,
} from '../../../mocks/vehicles'
import { MOCK_INSPECTIONS } from '../../../mocks/compliance'

const t = STRINGS.vehicles

export function VehicleDetailPage() {
  const { vehicleId } = useParams()
  const { vehicles } = useFleetData()

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

  const workOrders = MOCK_WORK_ORDERS.filter(
    (w) => w.vehicle === vehicle.name && w.status !== 'completed',
  )
  const inspections = MOCK_INSPECTIONS.filter((i) => i.vehicle === vehicle.name)

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
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title={t.detail.identity}>
          <DetailList>
            <DetailRow label={t.detail.plate}>
              <span className="font-mono">{vehicle.plate}</span>
            </DetailRow>
            <DetailRow label={t.detail.makeModel}>{vehicle.makeModel}</DetailRow>
            <DetailRow label={t.detail.year}>{vehicle.year}</DetailRow>
          </DetailList>
        </Panel>

        <Panel title={t.detail.condition}>
          <DetailList>
            <DetailRow label={t.detail.driver}>
              {vehicle.driver ?? <span className="text-ink-4">{t.unassigned}</span>}
            </DetailRow>
            <DetailRow label={t.detail.odometer}>
              <span className="font-mono">{vehicle.odometerKm.toLocaleString()} km</span>
            </DetailRow>
            <DetailRow label={t.detail.nextService}>
              {vehicle.nextServiceKm === 0 ? (
                <span className="text-ink-4">—</span>
              ) : vehicle.serviceOverdueKm > 0 ? (
                <span className="font-medium text-warn">{t.overdueBy(vehicle.serviceOverdueKm)}</span>
              ) : (
                t.dueIn(vehicle.nextServiceKm - vehicle.odometerKm)
              )}
            </DetailRow>
          </DetailList>
        </Panel>

        <Panel title={t.detail.openWorkOrders}>
          {workOrders.length === 0 ? (
            <EmptyState title={t.detail.noWorkOrders} />
          ) : (
            <ul className="divide-y divide-line">
              {workOrders.map((w) => (
                <li key={w.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium text-ink">{w.title}</p>
                    <p className="font-mono text-[12px] text-ink-3">
                      {w.reference} · {w.opened}
                    </p>
                  </div>
                  <Badge tone={WORK_ORDER_TONE[w.status]}>{WORK_ORDER_LABEL[w.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t.detail.recentInspections}>
          {inspections.length === 0 ? (
            <EmptyState title={t.detail.noInspections} />
          ) : (
            <ul className="divide-y divide-line">
              {inspections.map((i) => (
                <li key={i.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium text-ink">
                      {i.type} · {i.driver}
                    </p>
                    <p className="text-[12.5px] text-ink-3">{i.submitted}</p>
                  </div>
                  <Badge tone={i.defects > 0 ? 'danger' : 'success'}>
                    {i.defects > 0 ? `${i.defects} defects` : 'Clear'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </DetailShell>
  )
}
