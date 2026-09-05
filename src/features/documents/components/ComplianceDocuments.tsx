import { useCallback, useEffect, useState } from 'react'
import { STRINGS } from '../../../constants'
import { Panel } from '../../../components/layout/PageShell'
import { Alert, Badge, Button, EmptyState, useToast } from '../../../components/ui'
import { useAuth } from '../../auth/AuthProvider'
import * as api from '../../../supabase/api'
import { UploadDocumentDialog } from './UploadDocumentDialog'

const t = STRINGS.documents.compliance

/** "12 Aug 2026" — a date, not a moment. */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Compliance paperwork for one driver or vehicle, with upload and download.
 *
 * Loaded here rather than through the fleet-data provider: this is one owner's
 * documents on one screen, and pulling every document in the organisation into
 * shared state to show four of them would cost every screen the memory.
 */
export function ComplianceDocuments({
  owner,
}: {
  owner: { driverId: string; name: string } | { vehicleId: string; name: string }
}) {
  const { session } = useAuth()
  const { show } = useToast()
  const orgId = session?.organization.id ?? null

  const [rows, setRows] = useState<api.ComplianceDocumentRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [opening, setOpening] = useState<string | null>(null)

  const ownerKey = 'driverId' in owner ? owner.driverId : owner.vehicleId
  const isDriver = 'driverId' in owner

  const load = useCallback(async () => {
    if (!orgId) return
    setError(null)
    try {
      setRows(
        await api.loadComplianceDocuments(
          orgId,
          isDriver ? { driverId: ownerKey } : { vehicleId: ownerKey },
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadFailed)
    }
  }, [orgId, ownerKey, isDriver])

  useEffect(() => {
    void load()
  }, [load])

  /**
   * The link is signed for sixty seconds and fetched at click time, not when
   * the row renders — a URL minted on load would be dead by the time anybody
   * pressed it, and a page left open would leave live links lying about.
   */
  async function handleDownload(row: api.ComplianceDocumentRow) {
    if (!row.storagePath) return
    setOpening(row.id)
    try {
      const url = await api.documentDownloadUrl(row.storagePath)
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      show(err instanceof Error ? err.message : t.loadFailed)
    } finally {
      setOpening(null)
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <Panel
      title={t.title}
      hint={t.hint}
      action={
        <Button size="sm" variant="secondary" onClick={() => setUploading(true)}>
          {t.add}
        </Button>
      }
    >
      {error && (
        <div className="px-5 py-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}

      {!error && rows.length === 0 ? (
        <EmptyState title={t.empty} hint={t.emptyHint} />
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((row) => {
            const expired = row.expiresOn !== null && row.expiresOn < today
            return (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3.5 transition-colors hover:bg-surface-2"
              >
                <div className="min-w-[160px] flex-1">
                  <p className="text-[13.5px] font-medium text-ink">{row.title}</p>
                  <p className="mt-0.5 text-[12.5px] text-ink-3">
                    {row.reference ? `${row.reference} · ` : ''}
                    {row.expiresOn
                      ? expired
                        ? t.expired(formatDate(row.expiresOn))
                        : t.expires(formatDate(row.expiresOn))
                      : t.noExpiry}
                  </p>
                </div>
                {expired && <Badge tone="danger">{t.expired(formatDate(row.expiresOn!))}</Badge>}
                {/* Disabled with a reason rather than a button that hands over
                    nothing: some rows are a record with no file behind them. */}
                {row.storagePath ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={opening === row.id}
                    onClick={() => void handleDownload(row)}
                  >
                    {t.download}
                  </Button>
                ) : (
                  <span className="text-[12px] text-ink-4">{t.noFile}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <UploadDocumentDialog
        open={uploading}
        owner={owner}
        onClose={() => setUploading(false)}
        onUploaded={() => void load()}
      />
    </Panel>
  )
}
