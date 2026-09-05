import { useEffect, useState } from 'react'
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

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const doc = documents.find((d) => d.id === documentId)
  const storagePath = doc?.storagePath ?? null

  /*
    A signed URL for the preview, minted once when the page opens.

    The bucket is private, so there is no src to put in an img up front. Signed
    for the page view rather than on a click: this one IS the click — somebody
    opened a document to look at it.

    Cancelled on the way out so a slow sign for a document nobody is looking at
    any more cannot set state on an unmounted page.
  */
  useEffect(() => {
    if (!storagePath) return
    let cancelled = false
    setPreviewUrl(null)
    setPreviewError(null)

    api
      .documentDownloadUrl(storagePath)
      .then((url) => {
        if (cancelled) return
        if (url) setPreviewUrl(url)
        else setPreviewError(t.detail.previewFailed)
      })
      .catch(() => {
        if (!cancelled) setPreviewError(t.detail.previewFailed)
      })

    return () => {
      cancelled = true
    }
  }, [storagePath])

  const mime = doc?.mimeType ?? ''
  const isImage = mime.startsWith('image/')
  const isPdf = mime === 'application/pdf'

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
          {/*
            The file, drawn.

            This panel was called Preview and showed a file name, a size and a
            type — three things already in the panel beside it, and none of
            them the document. Somebody checking whether a licence had been
            photographed straight had to download it to find out.
          */}
          <div className="flex min-h-[320px] items-center justify-center bg-ground p-4">
            {!doc.storagePath ? (
              <p className="text-[13px] text-ink-3">{t.detail.noFile}</p>
            ) : previewError ? (
              <p className="text-[13px] text-ink-3">{previewError}</p>
            ) : !previewUrl ? (
              <p className="text-[13px] text-ink-3">{t.detail.previewLoading}</p>
            ) : isImage ? (
              <img
                src={previewUrl}
                alt={doc.name}
                className="max-h-[560px] w-auto max-w-full rounded-[10px] object-contain"
              />
            ) : isPdf ? (
              /* Browsers render a PDF in an iframe; anything else downloads
                 itself, which is not a preview. */
              <iframe
                src={previewUrl}
                title={doc.name}
                className="h-[560px] w-full rounded-[10px] border-0 bg-surface"
              />
            ) : (
              <div className="text-center">
                <p className="text-[13px] text-ink-3">{t.detail.previewNotDrawable}</p>
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-[13px] font-medium text-accent hover:underline"
                >
                  {t.detail.previewOpen}
                </a>
              </div>
            )}
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
