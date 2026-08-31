import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { STRINGS, TONE_SOLID, TONE_TEXT } from '../../../constants'
import { cn } from '../../../lib/cn'
import { DetailList, DetailRow, DetailShell } from '../../../components/layout/DetailShell'
import { Panel } from '../../../components/layout/PageShell'
import { Badge, Button, EmptyState, FilterChips } from '../../../components/ui'
import { useFleetData } from '../../fleet-data'
import { DRIVER_STATUS_LABEL, DRIVER_STATUS_TONE } from '../../../mocks/people'
import { LOG_DATES, LOG_STATE_LABEL, LOG_STATE_TONE, MOCK_INSPECTIONS, MOCK_LOGS } from '../../../mocks/compliance'
import { MOCK_SAFETY_EVENTS, SEVERITY_TONE } from '../../../mocks/admin'
import { MOCK_DOCUMENTS } from '../../../mocks/operations'

const t = STRINGS.drivers
type Tab = keyof typeof t.tabsDetail

/** Driver profile, reached from the drivers table or a search result. */
export function DriverDetailPage() {
  const { driverId } = useParams()
  const { drivers } = useFleetData()
  const [tab, setTab] = useState<Tab>('overview')

  const driver = drivers.find((d) => d.id === driverId)

  if (!driver) {
    return (
      <DetailShell backTo="/drivers" backLabel={t.back} title={t.notFound}>
        <Panel>
          <EmptyState title={t.notFound} />
        </Panel>
      </DetailShell>
    )
  }

  const logs = MOCK_LOGS.find((log) => log.driver === driver.name)
  const inspections = MOCK_INSPECTIONS.filter((i) => i.driver === driver.name)
  const safety = MOCK_SAFETY_EVENTS.filter((e) => e.driver === driver.name)
  const documents = MOCK_DOCUMENTS.filter((d) => d.driver === driver.name)

  return (
    <DetailShell
      backTo="/drivers"
      backLabel={t.back}
      title={driver.name}
      subtitle={`${driver.employeeNumber} · ${driver.terminal}`}
      badge={<Badge tone={DRIVER_STATUS_TONE[driver.status]}>{DRIVER_STATUS_LABEL[driver.status]}</Badge>}
      actions={
        <Link to="/messages">
          <Button size="sm" variant="secondary">
            {t.detail.message}
          </Button>
        </Link>
      }
    >
      <div className="mb-4">
        <FilterChips
          value={tab}
          onChange={setTab}
          options={(Object.keys(t.tabsDetail) as Tab[]).map((key) => ({
            value: key,
            label: t.tabsDetail[key],
          }))}
        />
      </div>

      {tab === 'overview' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title={t.detail.employment}>
            <DetailList>
              <DetailRow label={t.detail.employeeNumber}>{driver.employeeNumber}</DetailRow>
              <DetailRow label={t.detail.terminal}>{driver.terminal}</DetailRow>
              <DetailRow label={t.detail.status}>
                <Badge tone={DRIVER_STATUS_TONE[driver.status]}>
                  {DRIVER_STATUS_LABEL[driver.status]}
                </Badge>
              </DetailRow>
            </DetailList>
          </Panel>

          <Panel title={t.detail.compliance}>
            <DetailList>
              <DetailRow label={t.detail.hoursLeft}>
                <span
                  className={cn(
                    'font-mono',
                    driver.hoursLeft === '0:00' ? 'font-semibold text-danger' : 'text-ink',
                  )}
                >
                  {driver.hoursLeft}
                </span>
              </DetailRow>
              <DetailRow label={t.detail.licence}>
                <span className={driver.licenceWarning ? 'font-medium text-warn' : ''}>
                  {driver.licenceExpires}
                  {driver.licenceWarning && ` · ${t.licenceWarning}`}
                </span>
              </DetailRow>
              <DetailRow label={t.detail.safetyScore}>
                <span
                  className={cn(
                    'font-mono font-semibold',
                    driver.safetyScore >= 90
                      ? TONE_TEXT.success
                      : driver.safetyScore >= 75
                        ? 'text-ink'
                        : TONE_TEXT.warning,
                  )}
                >
                  {driver.safetyScore}
                </span>
              </DetailRow>
            </DetailList>
          </Panel>

          <Panel title={t.detail.currentAssignment} className="lg:col-span-2">
            {driver.vehicle ? (
              <DetailList>
                <DetailRow label={t.detail.vehicle}>{driver.vehicle}</DetailRow>
              </DetailList>
            ) : (
              <EmptyState title={t.noVehicle} hint={t.detail.noVehicleHint} />
            )}
          </Panel>
        </div>
      )}

      {tab === 'hours' && (
        <Panel title={t.detail.recentLogs}>
          {logs ? (
            <div className="flex flex-wrap gap-2 px-5 py-4">
              {logs.days.map((state, i) => {
                const tone = LOG_STATE_TONE[state]
                return (
                  <div key={i} className="flex min-w-[84px] flex-col items-center gap-1.5">
                    <span className="text-[11.5px] text-ink-3">{LOG_DATES[i]}</span>
                    <span
                      className={cn(
                        'h-7 w-full rounded-[4px]',
                        tone ? TONE_SOLID[tone] : 'bg-surface-2',
                        tone === 'success' && 'opacity-45',
                      )}
                    />
                    <span className="text-[11px] text-ink-4">{LOG_STATE_LABEL[state]}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState title={STRINGS.empty.noneYetTitle} />
          )}
        </Panel>
      )}

      {tab === 'inspections' && (
        <Panel>
          {inspections.length === 0 ? (
            <EmptyState title={t.detail.noInspections} />
          ) : (
            <ul className="divide-y divide-line">
              {inspections.map((i) => (
                <li key={i.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium text-ink">
                      {i.vehicle} · {i.type}
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
      )}

      {tab === 'safety' && (
        <Panel>
          {safety.length === 0 ? (
            <EmptyState title={t.detail.noSafety} />
          ) : (
            <ul className="divide-y divide-line">
              {safety.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium text-ink">{e.kind}</p>
                    <p className="text-[12.5px] text-ink-3">
                      {e.location} · {e.at}
                    </p>
                  </div>
                  <Badge tone={SEVERITY_TONE[e.severity]}>{e.severity}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {tab === 'documents' && (
        <Panel>
          {documents.length === 0 ? (
            <EmptyState title={t.detail.noDocuments} />
          ) : (
            <ul className="divide-y divide-line">
              {documents.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[13px] text-ink">{d.name}</p>
                    <p className="text-[12.5px] text-ink-3">
                      {d.kind} · {d.uploaded}
                    </p>
                  </div>
                  <span className="font-mono text-[12px] text-ink-4">{d.sizeKb} KB</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </DetailShell>
  )
}
