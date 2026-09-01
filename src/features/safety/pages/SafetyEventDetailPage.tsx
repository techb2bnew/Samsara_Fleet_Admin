import { Link, useParams } from 'react-router-dom'
import { useState } from 'react'
import { STRINGS } from '../../../constants'
import { DetailList, DetailRow, DetailShell } from '../../../components/layout/DetailShell'
import { Panel } from '../../../components/layout/PageShell'
import { Badge, Button, ConfirmDialog, EmptyState, useToast } from '../../../components/ui'
import { useFleetData } from '../../fleet-data'
import { SAFETY_STATUS_LABEL, SEVERITY_TONE } from '../../../mocks/admin'
import { hrefForDriverName } from '../../../lib/entityLinks'

const t = STRINGS.safety

export function SafetyEventDetailPage() {
  const { eventId } = useParams()
  const { safetyEvents, setSafetyEventStatus, drivers } = useFleetData()
  const { show } = useToast()
  const [pending, setPending] = useState<'coachable' | 'dismissed' | null>(null)

  const event = safetyEvents.find((e) => e.id === eventId)

  if (!event) {
    return (
      <DetailShell backTo="/safety" backLabel={t.back} title={t.notFound}>
        <Panel>
          <EmptyState title={t.notFound} />
        </Panel>
      </DetailShell>
    )
  }

  return (
    <DetailShell
      backTo="/safety"
      backLabel={t.back}
      title={event.kind}
      subtitle={`${event.driver} · ${event.at}`}
      badge={<Badge tone={SEVERITY_TONE[event.severity]}>{event.severity}</Badge>}
      actions={
        <>
          <Link to={hrefForDriverName(drivers, event.driver)}>
            <Button size="sm" variant="secondary">
              {t.detail.openDriver}
            </Button>
          </Link>
          {event.status === 'new' && (
            <>
              <Button size="sm" onClick={() => setPending('coachable')}>
                {t.assignCoaching}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPending('dismissed')}>
                {t.dismiss}
              </Button>
            </>
          )}
        </>
      }
    >
      <Panel title={t.detail.about}>
        <DetailList>
          <DetailRow label={t.detail.driver}>{event.driver}</DetailRow>
          <DetailRow label={t.detail.kind}>{event.kind}</DetailRow>
          <DetailRow label={t.detail.severity}>
            <Badge tone={SEVERITY_TONE[event.severity]}>{event.severity}</Badge>
          </DetailRow>
          <DetailRow label={t.detail.location}>{event.location}</DetailRow>
          <DetailRow label={t.detail.at}>{event.at}</DetailRow>
          <DetailRow label={t.detail.status}>{SAFETY_STATUS_LABEL[event.status]}</DetailRow>
        </DetailList>
      </Panel>

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (pending) {
            setSafetyEventStatus(event.id, pending)
            show(pending === 'coachable' ? t.coachedToast(event.driver) : t.dismissedToast)
          }
          setPending(null)
        }}
        title={pending === 'dismissed' ? t.confirmDismissTitle : t.confirmCoachTitle}
        message={
          pending === 'dismissed'
            ? t.confirmDismissMessage
            : t.confirmCoachMessage(event.driver, event.kind)
        }
        confirmLabel={pending === 'dismissed' ? t.confirmDismiss : t.confirmCoach}
        tone={pending === 'dismissed' ? 'danger' : 'primary'}
      />
    </DetailShell>
  )
}
