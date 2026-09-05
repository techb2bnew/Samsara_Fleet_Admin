import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { STRINGS } from '../../../constants'
import { DetailList, DetailRow, DetailShell } from '../../../components/layout/DetailShell'
import { Panel } from '../../../components/layout/PageShell'
import { Alert, Badge, Button, EmptyState } from '../../../components/ui'
import { useFleetData } from '../../fleet-data'
import * as api from '../../../supabase/api'
import { hrefForDriverName, hrefForVehicleName } from '../../../lib/entityLinks'

const t = STRINGS.documents

export function DocumentDetailPage() {
  const { documentId } = useParams()
  const { drivers, vehicles, documents } = useFleetData()
  const [opening, setOpening] = useState(false)
  const [openError, setOpenError] = useState<string | null>(null)

  const doc = documents.find((d) => d.id === documentId)

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
          {/*
            The real file, behind a link that expires. This used to build a
            .txt of the row's own fields and hand that over as "the document" —
            a driver's proof of delivery cannot be a summary of itself.
          */}
          <Button
            size="sm"
            variant="secondary"
            loading={opening}
            disabled={doc.storagePath === null}
            title={doc.storagePath === null ? t.detail.noFile : undefined}
            onClick={async () => {
              setOpening(true)
              setOpenError(null)
              try {
                const url = await api.documentDownloadUrl(doc.storagePath)
                if (!url) {
                  setOpenError(t.detail.noFile)
                  return
                }
                window.open(url, '_blank', 'noopener,noreferrer')
              } catch (error) {
                setOpenError(error instanceof Error ? error.message : t.detail.openFailed)
              } finally {
                setOpening(false)
              }
            }}
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
      {openError && (
        <div className="mb-5" role="alert">
          <Alert tone="danger">{openError}</Alert>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Panel title={t.detail.preview} hint={t.detail.previewHint}>
          <div className="flex min-h-[280px] flex-col items-center justify-center bg-ground px-6 py-16 text-center">
            <p className="font-mono text-[13.5px] text-ink">{doc.name}</p>
            <p className="mt-1 text-[12.5px] text-ink-3">
              {doc.sizeKb === null ? '—' : `${doc.sizeKb} KB`} · {doc.kind}
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
            <DetailRow label={t.detail.size}>{doc.sizeKb === null ? '—' : `${doc.sizeKb} KB`}</DetailRow>
          </DetailList>
        </Panel>
      </div>
    </DetailShell>
  )
}
