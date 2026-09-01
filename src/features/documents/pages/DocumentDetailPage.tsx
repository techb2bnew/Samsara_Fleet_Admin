import { Link, useParams } from 'react-router-dom'
import { STRINGS } from '../../../constants'
import { DetailList, DetailRow, DetailShell } from '../../../components/layout/DetailShell'
import { Panel } from '../../../components/layout/PageShell'
import { Badge, Button, EmptyState } from '../../../components/ui'
import { useFleetData } from '../../fleet-data'
import { MOCK_DOCUMENTS } from '../../../mocks/operations'
import { downloadText } from '../../../lib/csv'
import { hrefForDriverName, hrefForVehicleName } from '../../../lib/entityLinks'

const t = STRINGS.documents

export function DocumentDetailPage() {
  const { documentId } = useParams()
  const { drivers, vehicles } = useFleetData()
  const doc = MOCK_DOCUMENTS.find((d) => d.id === documentId)

  if (!doc) {
    return (
      <DetailShell backTo="/documents" backLabel={t.back} title={t.notFound}>
        <Panel>
          <EmptyState title={t.notFound} />
        </Panel>
      </DetailShell>
    )
  }

  return (
    <DetailShell
      backTo="/documents"
      backLabel={t.back}
      title={doc.name}
      subtitle={`${doc.kind} · ${doc.uploaded}`}
      badge={<Badge tone="neutral">{doc.kind}</Badge>}
      actions={
        <>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              downloadText(
                doc.name.replace(/\.[^.]+$/, '') + '.txt',
                [
                  doc.name,
                  doc.kind,
                  `Driver: ${doc.driver}`,
                  `Vehicle: ${doc.vehicle}`,
                  `Uploaded: ${doc.uploaded}`,
                  `Size: ${doc.sizeKb} KB`,
                ].join('\n'),
              )
            }
          >
            {t.detail.download}
          </Button>
          <Link to={hrefForDriverName(drivers, doc.driver)}>
            <Button size="sm" variant="secondary">
              {t.detail.openDriver}
            </Button>
          </Link>
          <Link to={hrefForVehicleName(vehicles, doc.vehicle)}>
            <Button size="sm" variant="secondary">
              {t.detail.openVehicle}
            </Button>
          </Link>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Panel title={t.detail.preview} hint={t.detail.previewHint}>
          <div className="flex min-h-[280px] flex-col items-center justify-center bg-ground px-6 py-16 text-center">
            <p className="font-mono text-[13.5px] text-ink">{doc.name}</p>
            <p className="mt-1 text-[12.5px] text-ink-3">
              {doc.sizeKb} KB · {doc.kind}
            </p>
          </div>
        </Panel>

        <Panel title={t.detail.about}>
          <DetailList>
            <DetailRow label={t.detail.file}>
              <span className="font-mono">{doc.name}</span>
            </DetailRow>
            <DetailRow label={t.detail.kind}>{doc.kind}</DetailRow>
            <DetailRow label={t.detail.driver}>{doc.driver}</DetailRow>
            <DetailRow label={t.detail.vehicle}>{doc.vehicle}</DetailRow>
            <DetailRow label={t.detail.uploaded}>{doc.uploaded}</DetailRow>
            <DetailRow label={t.detail.size}>{doc.sizeKb} KB</DetailRow>
          </DetailList>
        </Panel>
      </div>
    </DetailShell>
  )
}
