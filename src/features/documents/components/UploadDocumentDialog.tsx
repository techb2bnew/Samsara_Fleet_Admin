import { useEffect, useRef, useState, type FormEvent } from 'react'
import { STRINGS } from '../../../constants'
import { Alert, Button, Field, FormGrid, Modal, Select, useToast } from '../../../components/ui'
import { useAuth } from '../../auth/AuthProvider'
import * as api from '../../../supabase/api'

const t = STRINGS.documents.upload

/**
 * The document types the office files.
 *
 * A fixed list rather than free text: these become `doc_type`, and the
 * dashboard's expiry alerts read it. "Licence", "licence" and "DL" as three
 * separate types would each need their own alert.
 */
const DRIVER_TYPES = [
  { value: 'licence', label: 'Driving licence' },
  { value: 'medical', label: 'Medical certificate' },
  { value: 'training', label: 'Training certificate' },
  { value: 'police_verification', label: 'Police verification' },
  { value: 'other', label: 'Other' },
]

const VEHICLE_TYPES = [
  { value: 'rc', label: 'Registration certificate' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'fitness', label: 'Fitness certificate' },
  { value: 'permit', label: 'Permit' },
  { value: 'puc', label: 'Pollution certificate' },
  { value: 'other', label: 'Other' },
]

/** Types that genuinely expire. The date field only appears for these. */
const EXPIRES = new Set([
  'licence',
  'medical',
  'insurance',
  'fitness',
  'permit',
  'puc',
  'police_verification',
])

export function UploadDocumentDialog({
  open,
  onClose,
  onUploaded,
  owner,
  stacked = false,
}: {
  open: boolean
  onClose: () => void
  /** So the caller can re-read its own list. */
  onUploaded: () => void
  owner: { driverId: string; name: string } | { vehicleId: string; name: string }
  stacked?: boolean
}) {
  const { session } = useAuth()
  const { show } = useToast()

  const isDriver = 'driverId' in owner
  const types = isDriver ? DRIVER_TYPES : VEHICLE_TYPES

  const fileRef = useRef<HTMLInputElement>(null)
  const [docType, setDocType] = useState(types[0].value)
  const [title, setTitle] = useState('')
  const [reference, setReference] = useState('')
  const [expiresOn, setExpiresOn] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setDocType(types[0].value)
    setTitle('')
    setReference('')
    setExpiresOn('')
    setFile(null)
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }, [open, types])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!file) {
      setError(t.pickFile)
      return
    }
    if (file.size > api.DOCUMENT_MAX_BYTES) {
      setError(t.tooBig)
      return
    }
    const orgId = session?.organization.id
    if (!orgId) {
      setError(t.failed)
      return
    }

    setSaving(true)
    setError(null)
    try {
      await api.uploadDocument(orgId, {
        category: 'compliance',
        docType,
        title,
        reference,
        expiresOn: EXPIRES.has(docType) ? expiresOn : undefined,
        ...(isDriver ? { driverId: owner.driverId } : { vehicleId: owner.vehicleId }),
        file,
      })
      show(t.uploadedToast(owner.name))
      onUploaded()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.failed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.title}
      description={t.description(owner.name)}
      size="sm"
      stacked={stacked}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {STRINGS.common.cancel}
          </Button>
          <Button type="submit" form="upload-document-form" loading={saving}>
            {t.submit}
          </Button>
        </>
      }
    >
      <form id="upload-document-form" onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="mb-4">
            <Alert tone="danger">{error}</Alert>
          </div>
        )}
        <FormGrid>
          <Select
            label={t.docType}
            options={types}
            value={docType}
            onChange={(event) => setDocType(event.target.value)}
          />
          <Field
            label={t.reference}
            hint={t.referenceHint}
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
          {/* Only for types that expire. A "expires on" box next to a training
              certificate invites a date nobody should be relying on. */}
          {EXPIRES.has(docType) && (
            <Field
              label={t.expiresOn}
              type="date"
              hint={t.expiresOnHint}
              value={expiresOn}
              onChange={(event) => setExpiresOn(event.target.value)}
            />
          )}
          <Field
            label={t.titleField}
            hint={t.titleHint}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="document-file" className="text-[13px] font-medium text-ink">
              {t.file}
            </label>
            <input
              ref={fileRef}
              id="document-file"
              type="file"
              accept={api.DOCUMENT_MIME_TYPES.join(',')}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="rounded-[7px] border border-line bg-ground px-3 py-2 text-[13px] text-ink file:mr-3 file:rounded-[5px] file:border-0 file:bg-surface-2 file:px-2.5 file:py-1 file:text-[12.5px] file:text-ink-2"
            />
            <p className="text-[12px] text-ink-3">{t.fileHint}</p>
          </div>
        </FormGrid>
      </form>
    </Modal>
  )
}
