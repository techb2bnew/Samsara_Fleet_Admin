import { Link, useParams } from 'react-router-dom'
import { STRINGS } from '../../../constants'
import { DetailList, DetailRow, DetailShell } from '../../../components/layout/DetailShell'
import { Panel } from '../../../components/layout/PageShell'
import { Badge, Button, EmptyState } from '../../../components/ui'
import { useFleetData } from '../../fleet-data'
import { INSPECTION_LABEL, INSPECTION_TONE } from '../types'
import { DefectRow } from '../components/DefectActions'
import { hrefForPerson, hrefForVehicleName } from '../../../lib/entityLinks'

const t = STRINGS.inspections

export function InspectionDetailPage() {
  const { inspectionId } = useParams()
  const { drivers, vehicles, staff, inspections, inspectionDefects } = useFleetData()
  const inspection = inspections.find((i) => i.id === inspectionId)

  if (!inspection) {
    return (
      <DetailShell backTo="/inspections" backLabel={t.back} title={t.notFound}>
        <Panel>
          <EmptyState title={t.notFound} />
        </Panel>
      </DetailShell>
    )
  }

  const defects = inspectionDefects[inspection.id] ?? []
  const personHref = hrefForPerson(drivers, staff, inspection.driver)
  const personIsDriver = drivers.some((d) => d.name === inspection.driver)

  return (
    <DetailShell
      backTo="/inspections"
      backLabel={t.back}
      title={`${inspection.vehicle} · ${inspection.type}`}
      subtitle={inspection.submitted}
      badge={<Badge tone={INSPECTION_TONE[inspection.status]}>{INSPECTION_LABEL[inspection.status]}</Badge>}
      actions={
        <>
          <Link to={hrefForVehicleName(vehicles, inspection.vehicle)}>
            <Button size="sm" variant="secondary">
              {t.detail.openVehicle}
            </Button>
          </Link>
          <Link to={personHref}>
            <Button size="sm" variant="secondary">
              {personIsDriver ? t.detail.openDriver : t.detail.openStaff}
            </Button>
          </Link>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <Panel title={t.detail.summary}>
          <DetailList>
            <DetailRow label={t.detail.vehicle}>{inspection.vehicle}</DetailRow>
            <DetailRow label={t.detail.driver}>{inspection.driver}</DetailRow>
            <DetailRow label={t.detail.type}>{inspection.type}</DetailRow>
            <DetailRow label={t.detail.submitted}>{inspection.submitted}</DetailRow>
            <DetailRow label={t.detail.status}>
              <Badge tone={INSPECTION_TONE[inspection.status]}>
                {INSPECTION_LABEL[inspection.status]}
              </Badge>
            </DetailRow>
          </DetailList>
        </Panel>

        <Panel title={t.detail.defectsTitle} hint={t.detail.defectsHint}>
          {defects.length === 0 ? (
            <EmptyState title={t.detail.noDefects} />
          ) : (
            <ul className="divide-y divide-line">
              {defects.map((d) => (
                <DefectRow key={d.id} defect={d} vehicleName={inspection.vehicle} />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </DetailShell>
  )
}
