import { Link, useParams } from 'react-router-dom'
import { STRINGS } from '../../../constants'
import { DetailList, DetailRow, DetailShell } from '../../../components/layout/DetailShell'
import { Panel } from '../../../components/layout/PageShell'
import { Badge, Button, EmptyState } from '../../../components/ui'
import { useFleetData } from '../../fleet-data'
import { WORK_ORDER_LABEL, WORK_ORDER_TONE } from '../types'
import { hrefForVehicleName } from '../../../lib/entityLinks'

const t = STRINGS.vehicles

export function WorkOrderDetailPage() {
  const { workOrderId } = useParams()
  const { vehicles, workOrders } = useFleetData()
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
            {t.woDetail.openVehicle}
          </Button>
        </Link>
      }
    >
      <Panel title={t.woDetail.about} className="max-w-[560px]">
        <DetailList>
          <DetailRow label={t.woDetail.reference}>
            <span className="font-mono">{order.reference}</span>
          </DetailRow>
          <DetailRow label={t.woDetail.vehicle}>{order.vehicle}</DetailRow>
          <DetailRow label={t.woDetail.job}>{order.title}</DetailRow>
          <DetailRow label={t.woDetail.status}>
            <Badge tone={WORK_ORDER_TONE[order.status]}>{WORK_ORDER_LABEL[order.status]}</Badge>
          </DetailRow>
          <DetailRow label={t.woDetail.mechanic}>
            {order.mechanic ?? <span className="text-ink-4">{t.unassigned}</span>}
          </DetailRow>
          <DetailRow label={t.woDetail.opened}>{order.opened}</DetailRow>
          <DetailRow label={t.woDetail.cost}>
            {order.costRupees > 0 ? (
              <span className="font-mono">₹{order.costRupees.toLocaleString()}</span>
            ) : (
              <span className="text-ink-4">—</span>
            )}
          </DetailRow>
        </DetailList>
      </Panel>
    </DetailShell>
  )
}
