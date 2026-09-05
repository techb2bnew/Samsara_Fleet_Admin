import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { STRINGS, TONE_TEXT } from '../../../constants'
import { cn } from '../../../lib/cn'
import { DetailList, DetailRow, DetailShell } from '../../../components/layout/DetailShell'
import { Panel } from '../../../components/layout/PageShell'
import { Badge, Button, EmptyState, FilterChips, useToast } from '../../../components/ui'
import { useFleetData } from '../../fleet-data'
import { ComplianceDocuments } from '../../documents/components/ComplianceDocuments'
import { DUTY_LABEL, DUTY_TONE, EMPLOYMENT_LABEL, EMPLOYMENT_TONE } from '../types'
import { SEVERITY_TONE } from '../../safety/types'
import { hrefForDriverThread, hrefForVehicleName } from '../../../lib/entityLinks'
import { DriverHoursTab } from '../components/DriverHoursTab'
import { AddDriverDialog } from '../components/AddDriverDialog'
import { InviteHandover } from '../components/InviteHandover'

const t = STRINGS.drivers
type Tab = keyof typeof t.tabsDetail
const TABS = Object.keys(t.tabsDetail) as Tab[]

function isTab(value: string | null): value is Tab {
  return TABS.includes(value as Tab)
}

/** Driver profile, reached from the drivers table or a search result. */
export function DriverDetailPage() {
  const { driverId } = useParams()
  const [params, setParams] = useSearchParams()
  const { drivers, vehicles, logs, inspections, documents, safetyEvents, inviteDriver } = useFleetData()
  // Read once into a variable: a type guard narrows the expression it is given,
  // and calling params.get() a second time produces a fresh `string | null`
  // that the guard has said nothing about.
  const tabParam = params.get('tab')
  const tab: Tab = isTab(tabParam) ? tabParam : 'overview'
  const [editing, setEditing] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [handover, setHandover] = useState<{
    name: string
    email: string
    password: string
    reason?: string
  } | null>(null)
  const { show } = useToast()

  function setTab(next: Tab) {
    const nextParams = new URLSearchParams(params)
    if (next === 'overview') nextParams.delete('tab')
    else nextParams.set('tab', next)
    setParams(nextParams, { replace: true })
  }

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

  const record = driver

  const driverLog = logs.find((log) => log.driver === record.name)
  const driverInspections = inspections.filter((i) => i.driver === record.name)
  const safety = safetyEvents.filter((e) => e.driver === record.name)
  const driverDocuments = documents.filter((d) => d.driver === record.name)

  async function handleInvite() {
    if (!record.email || record.onApp) return
    setInviting(true)
    try {
      const result = await inviteDriver(record.id)
      if (result.password) {
        setHandover({
          name: record.name,
          email: result.email || record.email,
          password: result.password,
          reason: result.reason,
        })
        return
      }
      show(t.detail.inviteToast(record.name))
    } catch (error) {
      show(error instanceof Error ? error.message : t.detail.inviteFailed)
    } finally {
      setInviting(false)
    }
  }

  return (
    <DetailShell
      backTo="/drivers"
      backLabel={t.back}
      title={driver.name}
      subtitle={
        [driver.employeeNumber, driver.depot?.name].filter((part) => part && part !== '—').join(' · ') ||
        undefined
      }
      badge={
        <Badge tone={EMPLOYMENT_TONE[driver.employment]}>
          {EMPLOYMENT_LABEL[driver.employment]}
        </Badge>
      }
      actions={
        <>
          {!driver.onApp && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void handleInvite()}
              loading={inviting}
              disabled={!driver.email}
              title={driver.email ? undefined : t.detail.inviteNeedEmail}
            >
              {t.detail.inviteApp}
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            {t.detail.edit}
          </Button>
          <Link to={hrefForDriverThread(driver.name)}>
            <Button size="sm" variant="secondary">
              {t.detail.message}
            </Button>
          </Link>
        </>
      }
    >
      <div className="mb-4">
        <FilterChips
          layout="scroll"
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
              <DetailRow label={t.detail.employeeNumber}>
                {driver.employeeNumber || '—'}
              </DetailRow>
              <DetailRow label={t.detail.depot}>{driver.depot?.name ?? '—'}</DetailRow>
              <DetailRow label={t.detail.email}>
                {driver.email || <span className="text-ink-3">—</span>}
              </DetailRow>
              <DetailRow label={t.detail.phone}>
                {driver.phone || <span className="text-ink-3">—</span>}
              </DetailRow>
              <DetailRow label={t.detail.employmentStatus}>
                <Badge tone={EMPLOYMENT_TONE[driver.employment]}>
                  {EMPLOYMENT_LABEL[driver.employment]}
                </Badge>
              </DetailRow>
              <DetailRow label={t.detail.onApp}>
                {driver.onApp ? t.detail.onAppYes : t.detail.onAppNo}
              </DetailRow>
            </DetailList>
          </Panel>

          <Panel title={t.detail.compliance}>
            <DetailList>
              <DetailRow label={t.detail.status}>
                {driver.duty ? (
                  <Badge tone={DUTY_TONE[driver.duty]}>{DUTY_LABEL[driver.duty]}</Badge>
                ) : (
                  <span className="text-ink-3">{t.detail.notRecorded}</span>
                )}
              </DetailRow>
              <DetailRow label={t.detail.hoursLeft}>
                {driver.hoursLeft === null ? (
                  <span className="text-ink-3">{t.detail.notRecorded}</span>
                ) : (
                  <span
                    className={cn(
                      'font-mono',
                      driver.hoursLeft === '0:00' ? 'font-semibold text-danger' : 'text-ink',
                    )}
                  >
                    {driver.hoursLeft}
                  </span>
                )}
              </DetailRow>
              <DetailRow label={t.detail.licence}>
                {driver.licenceExpires === null ? (
                  <span className="text-ink-3">{t.detail.noLicence}</span>
                ) : (
                  <span
                    className={cn(
                      driver.licenceExpired && 'font-semibold text-danger',
                      driver.licenceWarning && 'font-medium text-warn',
                    )}
                  >
                    {driver.licenceExpires}
                    {driver.licenceExpired && ` · ${t.licenceExpired}`}
                    {driver.licenceWarning && ` · ${t.licenceWarning}`}
                  </span>
                )}
              </DetailRow>
              <DetailRow label={t.detail.safetyScore}>
                {driver.safetyScore === null ? (
                  <span className="text-ink-3">{t.detail.notScored}</span>
                ) : (
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
                )}
              </DetailRow>
            </DetailList>
          </Panel>

          <Panel title={t.detail.currentAssignment} className="lg:col-span-2">
            {driver.vehicle ? (
              <DetailList>
                <DetailRow label={t.detail.vehicle}>
                  <Link to={hrefForVehicleName(vehicles, driver.vehicle)} className="text-accent hover:underline">
                    {driver.vehicle}
                  </Link>
                </DetailRow>
              </DetailList>
            ) : (
              <EmptyState title={t.noVehicle} hint={t.detail.noVehicleHint} />
            )}
          </Panel>
        </div>
      )}

      {tab === 'hours' && <DriverHoursTab driver={driver} logs={driverLog} />}

      {tab === 'inspections' && (
        <Panel>
          {driverInspections.length === 0 ? (
            <EmptyState title={t.detail.noInspections} />
          ) : (
            <ul className="divide-y divide-line">
              {driverInspections.map((i) => (
                <li key={i.id}>
                  <Link
                    to={`/inspections/${i.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2"
                  >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium text-ink">
                      {i.vehicle} · {i.type}
                    </p>
                    <p className="text-[12.5px] text-ink-3">{i.submitted}</p>
                  </div>
                  <Badge tone={i.defects > 0 ? 'danger' : 'success'}>
                    {i.defects > 0 ? `${i.defects} defects` : 'Clear'}
                  </Badge>
                  </Link>
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
                <li key={e.id}>
                  <Link
                    to={`/safety/${e.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium text-ink">{e.kind}</p>
                      <p className="text-[12.5px] text-ink-3">
                        {e.location} · {e.at}
                      </p>
                    </div>
                    <Badge tone={SEVERITY_TONE[e.severity]}>{e.severity}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {tab === 'documents' && (
        <div className="flex flex-col gap-5">
          {/* Two lists, because they are two different things: compliance
              paperwork the office files, and trip paperwork that came back
              from the cab. Same table, different category. */}
          <ComplianceDocuments owner={{ driverId: driver.id, name: driver.name }} />

          <Panel title={t.detail.tripDocuments} hint={t.detail.tripDocumentsHint}>
          {driverDocuments.length === 0 ? (
            <EmptyState title={t.detail.noDocuments} />
          ) : (
            <ul className="divide-y divide-line">
              {driverDocuments.map((d) => (
                <li key={d.id}>
                  <Link
                    to={`/documents/${d.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[13px] text-ink">{d.name}</p>
                      <p className="text-[12.5px] text-ink-3">
                        {d.kind} · {d.uploaded}
                      </p>
                    </div>
                    <span className="font-mono text-[12px] text-ink-4">{d.sizeKb} KB</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          </Panel>
        </div>
      )}
      <AddDriverDialog open={editing} driver={driver} onClose={() => setEditing(false)} />
      {handover && (
        <InviteHandover
          open
          name={handover.name}
          email={handover.email}
          password={handover.password}
          reason={handover.reason}
          onClose={() => setHandover(null)}
        />
      )}
    </DetailShell>
  )
}
