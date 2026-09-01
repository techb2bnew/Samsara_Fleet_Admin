import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { STRINGS } from '../../../constants'
import { Alert, ArrowRightIcon, Button, Modal } from '../../../components/ui'
import type { EditRequest, Violation } from '../../../mocks/compliance'
import { hrefForDriverName, hrefForVehicleName } from '../../../lib/entityLinks'
import type { Driver } from '../../../mocks/people'
import type { Vehicle } from '../../../mocks/vehicles'

const t = STRINGS.hours

function ReviewField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 py-2.5 sm:grid-cols-[128px_minmax(0,1fr)] sm:items-start sm:gap-x-4">
      <dt className="pt-0.5 text-[12px] font-medium text-ink-3">{label}</dt>
      <dd className="min-w-0 text-[13.5px] leading-snug text-ink">{children}</dd>
    </div>
  )
}

export function ReviewViolationDialog({
  violation,
  drivers,
  vehicles,
  onClose,
  onDecide,
}: {
  violation: Violation | null
  drivers: Driver[]
  vehicles: Vehicle[]
  onClose: () => void
  onDecide: (decision: 'approve' | 'reject') => void
}) {
  return (
    <Modal
      open={violation !== null}
      onClose={onClose}
      title={t.reviewViolationTitle}
      description={t.reviewViolationHint}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {STRINGS.common.cancel}
          </Button>
          <Button variant="danger" onClick={() => onDecide('reject')}>
            {t.reject}
          </Button>
          <Button onClick={() => onDecide('approve')}>{t.approve}</Button>
        </>
      }
    >
      {violation && (
        <div className="flex flex-col gap-4">
          <dl className="divide-y divide-line rounded-[10px] border border-line px-4">
            <ReviewField label={t.fields.driver}>
              <Link to={hrefForDriverName(drivers, violation.driver)} className="hover:text-accent">
                {violation.driver}
              </Link>
            </ReviewField>
            <ReviewField label={t.fields.vehicle}>
              <Link to={hrefForVehicleName(vehicles, violation.vehicle)} className="hover:text-accent">
                {violation.vehicle}
              </Link>
            </ReviewField>
            <ReviewField label={t.fields.rule}>{violation.type}</ReviewField>
            <ReviewField label={t.fields.logDate}>{violation.logDate}</ReviewField>
            <ReviewField label={t.fields.occurred}>{violation.occurred}</ReviewField>
            <ReviewField label={t.fields.limit}>{violation.limit}</ReviewField>
            <ReviewField label={t.fields.actual}>{violation.actual}</ReviewField>
            {violation.overage && (
              <ReviewField label={t.fields.overage}>{violation.overage}</ReviewField>
            )}
            <ReviewField label={t.fields.location}>{violation.location}</ReviewField>
          </dl>
          <Alert tone="warning">{t.violationDecisionNote}</Alert>
        </div>
      )}
    </Modal>
  )
}

export function ReviewCorrectionDialog({
  request,
  drivers,
  vehicles,
  onClose,
  onDecide,
}: {
  request: EditRequest | null
  drivers: Driver[]
  vehicles: Vehicle[]
  onClose: () => void
  onDecide: (decision: 'approve' | 'reject') => void
}) {
  return (
    <Modal
      open={request !== null}
      onClose={onClose}
      title={t.reviewCorrectionTitle}
      description={t.reviewCorrectionHint}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {STRINGS.common.cancel}
          </Button>
          <Button variant="danger" onClick={() => onDecide('reject')}>
            {t.reject}
          </Button>
          <Button onClick={() => onDecide('approve')}>{t.approve}</Button>
        </>
      }
    >
      {request && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-[10px] border border-line bg-surface-2 p-3.5 sm:flex-row sm:items-stretch sm:gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold tracking-[0.06em] text-ink-4 uppercase">
                {t.fields.loggedAs}
              </p>
              <p className="mt-1 text-[15px] font-semibold text-ink">{request.fromStatus}</p>
            </div>
            <div className="hidden items-center text-ink-4 sm:flex" aria-hidden="true">
              <ArrowRightIcon size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold tracking-[0.06em] text-ink-4 uppercase">
                {t.fields.changeTo}
              </p>
              <p className="mt-1 text-[15px] font-semibold text-accent">{request.toStatus}</p>
            </div>
          </div>

          <dl className="divide-y divide-line rounded-[10px] border border-line px-4">
            <ReviewField label={t.fields.driver}>
              <Link to={hrefForDriverName(drivers, request.driver)} className="hover:text-accent">
                {request.driver}
              </Link>
            </ReviewField>
            <ReviewField label={t.fields.vehicle}>
              <Link to={hrefForVehicleName(vehicles, request.vehicle)} className="hover:text-accent">
                {request.vehicle}
              </Link>
            </ReviewField>
            <ReviewField label={t.fields.kind}>{t.requestKinds[request.kind]}</ReviewField>
            <ReviewField label={t.fields.logDate}>{request.logDate}</ReviewField>
            <ReviewField label={t.fields.timeBlock}>
              {t.timeRange(request.timeFrom, request.timeTo)}
            </ReviewField>
            <ReviewField label={t.fields.reason}>&ldquo;{request.reason}&rdquo;</ReviewField>
          </dl>

          <Alert tone="warning">{t.correctionDecisionNote(request.driver)}</Alert>
        </div>
      )}
    </Modal>
  )
}
