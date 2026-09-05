import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { STRINGS, TONE_SOLID } from '../../../constants'
import { cn } from '../../../lib/cn'
import { PageShell, Panel } from '../../../components/layout/PageShell'
import { Alert, Button, ConfirmDialog, EmptyState, useToast } from '../../../components/ui'
import { datesForPeriod, formatLogColumn, formatPeriodLabel, isSameDay, type HoursPeriod } from '../dates'
import {
  logStateOn,
  LOG_STATE_LABEL,
  LOG_STATE_TONE,
  type UnassignedSegment,
} from '../types'
import { useFleetData } from '../../fleet-data'
import { csvFilename, downloadCsv } from '../../../lib/csv'
import { hrefForDriverName } from '../../../lib/entityLinks'
import { ReviewCorrectionDialog, ReviewViolationDialog } from '../components/HoursReviewDialogs'
import { AssignDrivingDialog } from '../components/AssignDrivingDialog'
import { LogPeriodControls } from '../components/LogPeriodControls'
import { HosLogGrid } from '../components/HosLogGrid'
import { dayRecap } from '../totals'

const t = STRINGS.hours

/**
 * Module A06.
 *
 * The grid is the centre of this screen because it answers the compliance
 * officer's real question — "is anything not certified?" — across the whole
 * fleet at a glance, rather than one driver at a time.
 *
 * Review opens a detail popup, not a bare confirmation. Approving a correction
 * does not edit the driver's log: it sends the change to their phone for them
 * to accept, because a carrier may not alter a driver's record on their behalf.
 */
export function HoursPage() {
  const {
    violations,
    editRequests,
    resolveViolation,
    resolveEditRequest,
    drivers,
    vehicles,
    logs,
    unassigned,
    opsStatus,
    opsError,
    reloadOps,
    dutySegmentsFor,
    cycleWindowFor,
    violationsEvaluated,
    unassignedDetected,
  } = useFleetData()
  const { show } = useToast()

  const [reviewingViolation, setReviewingViolation] = useState<(typeof violations)[number] | null>(
    null,
  )
  const [reviewingRequest, setReviewingRequest] = useState<(typeof editRequests)[number] | null>(
    null,
  )
  const [assigned, setAssigned] = useState<string[]>([])
  const [assigning, setAssigning] = useState<UnassignedSegment | null>(null)
  const [exporting, setExporting] = useState(false)
  const [period, setPeriod] = useState<HoursPeriod>('week')
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])
  const [anchor, setAnchor] = useState(today)

  /**
   * Drivers ticked in the grid, whose graphs open above it.
   *
   * A Set of ids rather than an array: ticking is a membership question, and
   * an array would need a filter on every untick and could hold a driver
   * twice.
   */
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())

  function toggleSelected(driverId: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (!next.delete(driverId)) next.add(driverId)
      return next
    })
  }

  /**
   * The graph is one day. The grid may be showing a week or a month, so the
   * anchor date is the day it is centred on — and the panel says which day it
   * is rather than leaving it to be guessed.
   */
  const graphDayLabel = anchor.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const dates = useMemo(() => datesForPeriod(period, anchor), [period, anchor])
  const periodLabel = formatPeriodLabel(period, dates)

  const openViolations = violations.filter((v) => v.status === 'open')
  const openUnassigned = unassigned.filter((u) => !assigned.includes(u.id))

  /**
   * The audit pack an inspector asks for: one row per driver per day, with the
   * certification state spelled out rather than left as a colour. A regulator
   * reads this in a spreadsheet, not in the console.
   */
  function exportAuditPack() {
    const rows = logs.flatMap((log) =>
      dates.map((date) => [
        log.driver,
        date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }),
        LOG_STATE_LABEL[logStateOn(log, date)],
      ]),
    )
    // An empty audit pack is worse than none: an inspector opening a file with
    // only headers reads it as "this fleet keeps no records".
    if (rows.length === 0) {
      show(t.nothingToExport)
      return
    }

    const filename = csvFilename('working-hours-audit')
    downloadCsv(filename, ['Driver', 'Date', 'Status'], rows)
    show(STRINGS.export.started(filename))
  }

  return (
    <PageShell
      eyebrow="Module A06"
      title={t.title}
      description={t.description}
      actions={
        <Button size="sm" variant="secondary" onClick={() => setExporting(true)}>
          {t.exportPack}
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        {opsStatus === 'error' && (
          <div role="alert">
            <Alert tone="danger" title={t.loadFailed}>
              <div className="flex flex-wrap items-center gap-3">
                <span>{opsError}</span>
                <Button size="sm" variant="secondary" onClick={reloadOps}>
                  {STRINGS.common.retry}
                </Button>
              </div>
            </Alert>
          </div>
        )}

        <Panel
          title={t.gridTitle}
          hint={`${t.gridHints[period]} · ${periodLabel}`}
          action={
            selected.size > 0 ? (
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                {t.graphsClear}
              </Button>
            ) : undefined
          }
        >
          <LogPeriodControls
            period={period}
            onPeriodChange={setPeriod}
            anchor={anchor}
            onAnchorChange={setAnchor}
            today={today}
            label={periodLabel}
          />
          {logs.length === 0 ? (
            <EmptyState
              title={opsStatus === 'loading' ? t.loading : t.noLogs}
              hint={opsStatus === 'loading' ? undefined : t.noLogsHint}
            />
          ) : (
          <div className="overflow-x-auto px-4 py-4 sm:px-5">
            <table
              className={cn(
                'w-full border-collapse',
                period === 'week' && 'min-w-[640px]',
                period === 'month' && 'min-w-[920px]',
              )}
            >
              <thead>
                <tr>
                  <th className="w-7 pb-2" />
                  <th className="pb-2 text-left text-[11px] font-semibold tracking-[0.07em] text-ink-3 uppercase">
                    Driver
                  </th>
                  {dates.map((date) => {
                    const todayCol = isSameDay(date, today)
                    return (
                      <th
                        key={date.toISOString()}
                        className={cn(
                          'px-1 pb-2 text-center text-[11px] font-medium whitespace-nowrap',
                          todayCol ? 'font-semibold text-accent' : 'text-ink-3',
                        )}
                      >
                        {formatLogColumn(date, period)}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <Fragment key={log.driverId}>
                  <tr className="border-t border-line">
                    <td className="py-2 pr-2">
                      <input
                        type="checkbox"
                        className="size-3.5 rounded-[3px] border-line-strong accent-accent"
                        checked={selected.has(log.driverId)}
                        onChange={() => toggleSelected(log.driverId)}
                        aria-label={t.selectDriverAria(log.driver)}
                      />
                    </td>
                    <td className="py-2 pr-4 text-[13px] font-medium whitespace-nowrap">
                      <Link to={`/drivers/${log.driverId}?tab=hours`} className="text-ink hover:text-accent">
                        {log.driver}
                      </Link>
                    </td>
                    {dates.map((date) => {
                      const state = logStateOn(log, date)
                      const tone = LOG_STATE_TONE[state]
                      const todayCol = isSameDay(date, today)
                      const label = `${formatLogColumn(date, period === 'month' ? 'week' : period)} — ${LOG_STATE_LABEL[state]}`
                      return (
                        <td key={date.toISOString()} className="px-1 py-2 text-center">
                          <span
                            title={label}
                            className={cn(
                              'inline-block h-6 w-full rounded-[5px]',
                              period === 'day' ? 'min-w-[72px]' : period === 'month' ? 'min-w-[16px]' : 'min-w-[26px]',
                              tone ? TONE_SOLID[tone] : 'bg-surface-2',
                              tone === 'success' && 'opacity-45',
                              todayCol && 'ring-1 ring-accent/40 ring-offset-1 ring-offset-surface',
                            )}
                          />
                          {period === 'day' && (
                            <span className="mt-1 block text-[11px] text-ink-3">
                              {LOG_STATE_LABEL[state]}
                            </span>
                          )}
                          <span className="sr-only">{LOG_STATE_LABEL[state]}</span>
                        </td>
                      )
                    })}
                  </tr>

                  {/* The graph opens under the row it belongs to, inside the
                      same table, so the day-by-day colours above it stay in
                      view while the detail is read. colSpan covers the tick
                      column, the name column and every date. */}
                  {selected.has(log.driverId) && (
                    <tr className="border-t border-line bg-surface-2/40">
                      <td colSpan={dates.length + 2} className="p-0">
                        <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-3 sm:px-4">
                          <p className="text-[12.5px] font-medium text-ink-2">
                            {t.graphsDay(log.driver, graphDayLabel)}
                          </p>
                          <Link
                            to={`/drivers/${log.driverId}?tab=hours`}
                            className="text-[12.5px] text-accent hover:underline"
                          >
                            {t.graphsOpenProfile}
                          </Link>
                        </div>
                        {/* Hours used, measured from the duty events — see
                            hours/totals. Null on a day with nothing recorded,
                            which the grid shows as dashes. */}
                        <HosLogGrid
                          segments={dutySegmentsFor(log.driverId, anchor)}
                          clocks={dayRecap(
                            dutySegmentsFor(log.driverId, anchor),
                            cycleWindowFor(log.driverId, anchor),
                          )}
                        />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>

            <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-line pt-3">
              <span className="text-[11px] font-semibold tracking-[0.07em] text-ink-4 uppercase">
                {t.legend}
              </span>
              {(['certified', 'uncertified', 'violation', 'missing', 'off'] as const).map((state) => {
                const tone = LOG_STATE_TONE[state]
                return (
                  <span key={state} className="flex items-center gap-1.5 text-[12px] text-ink-3">
                    <span
                      className={cn(
                        'size-3 rounded-[3px]',
                        tone ? TONE_SOLID[tone] : 'bg-surface-2',
                        tone === 'success' && 'opacity-45',
                      )}
                    />
                    {LOG_STATE_LABEL[state]}
                  </span>
                )
              })}
            </div>
          </div>
          )}
        </Panel>

        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title={t.violationsTitle} hint={t.violationsHint}>
            {!violationsEvaluated ? (
              <EmptyState title={t.violationsNotEvaluated} hint={t.violationsNotEvaluatedHint} />
            ) : violations.length === 0 ? (
              <EmptyState title={t.noViolations} />
            ) : openViolations.length === 0 ? (
              <EmptyState title={t.allViolationsReviewed} />
            ) : (
              <ul className="divide-y divide-line">
                {openViolations.map((violation) => (
                  <li
                    key={violation.id}
                    className="flex flex-col gap-2.5 px-4 py-3.5 transition-colors hover:bg-surface-2 sm:flex-row sm:items-start sm:gap-3 sm:px-5"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span
                      className={cn('mt-1.5 size-2 shrink-0 rounded-full', TONE_SOLID.danger)}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium text-ink">{violation.type}</p>
                      <p className="mt-0.5 text-[12.5px] text-ink-3">
                        <Link to={hrefForDriverName(drivers, violation.driver)} className="hover:text-accent">
                          {violation.driver}
                        </Link>
                        {' · '}
                        {violation.detail}
                      </p>
                      <p className="mt-1 text-[11.5px] text-ink-4">{violation.occurred}</p>
                    </div>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="self-start"
                      onClick={() => setReviewingViolation(violation)}
                    >
                      {t.review}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <div className="flex flex-col gap-5">
            <Panel title={t.editRequestsTitle} hint={t.editRequestsHint}>
              {editRequests.length === 0 ? (
                <EmptyState title={t.noEditRequests} />
              ) : (
                <ul className="divide-y divide-line">
                  {editRequests.map((request) => (
                    <li
                      key={request.id}
                      className="flex flex-col gap-2.5 px-4 py-3.5 transition-colors hover:bg-surface-2 sm:flex-row sm:items-start sm:gap-3 sm:px-5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-medium text-ink">
                          <Link to={hrefForDriverName(drivers, request.driver)} className="hover:text-accent">
                            {request.driver}
                          </Link>
                        </p>
                        <p className="mt-0.5 text-[12.5px] text-ink-2">
                          {t.statusChange(request.fromStatus, request.toStatus)}
                        </p>
                        <p className="mt-0.5 text-[12.5px] text-ink-3">
                          {t.timeRange(request.timeFrom, request.timeTo)}
                          {' · '}
                          {request.logDate}
                        </p>
                        <p className="mt-1 text-[12px] text-ink-3">&ldquo;{request.reason}&rdquo;</p>
                      </div>
                      <div className="flex shrink-0 sm:flex-col sm:items-end">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setReviewingRequest(request)}
                        >
                          {t.review}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title={t.unassignedTitle} hint={t.unassignedHint}>
              {!unassignedDetected ? (
                <EmptyState title={t.unassignedNotDetected} hint={t.unassignedNotDetectedHint} />
              ) : openUnassigned.length === 0 ? (
                <EmptyState title={t.noUnassigned} />
              ) : (
                <ul className="divide-y divide-line">
                  {openUnassigned.map((segment) => (
                    <li
                      key={segment.id}
                      className="flex flex-col gap-2.5 px-4 py-3 transition-colors hover:bg-surface-2 sm:flex-row sm:items-center sm:gap-3 sm:px-5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-medium text-ink">{segment.vehicle}</p>
                        <p className="text-[12.5px] text-ink-3">
                          {segment.period} · {segment.distanceKm} km
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="self-start"
                        onClick={() => setAssigning(segment)}
                      >
                        {t.assign}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      </div>

      <ReviewViolationDialog
        violation={reviewingViolation}
        drivers={drivers}
        vehicles={vehicles}
        onClose={() => setReviewingViolation(null)}
        onDecide={(decision) => {
          if (!reviewingViolation) return
          resolveViolation(reviewingViolation.id, decision)
          show(decision === 'approve' ? t.approvedViolationToast : t.dismissedViolationToast)
          setReviewingViolation(null)
        }}
      />

      <ReviewCorrectionDialog
        request={reviewingRequest}
        drivers={drivers}
        vehicles={vehicles}
        onClose={() => setReviewingRequest(null)}
        onDecide={async (decision) => {
          if (!reviewingRequest) return
          try {
            await resolveEditRequest(reviewingRequest.id, decision)
          } catch (error) {
            // A compliance decision that did not save must say so. Announcing
            // success here is how a correction silently never gets decided.
            show(error instanceof Error ? error.message : t.decisionFailed)
            setReviewingRequest(null)
            return
          }
          show(decision === 'approve' ? t.approvedToast : t.rejectedToast)
          setReviewingRequest(null)
        }}
      />

      <AssignDrivingDialog
        segment={assigning}
        drivers={drivers}
        vehicles={vehicles}
        onClose={() => setAssigning(null)}
        onAssign={(driverName) => {
          if (!assigning) return
          setAssigned((current) => [...current, assigning.id])
          show(t.assignedToast(driverName))
          setAssigning(null)
        }}
      />

      <ConfirmDialog
        open={exporting}
        onClose={() => setExporting(false)}
        onConfirm={() => {
          setExporting(false)
          exportAuditPack()
        }}
        title={t.confirmExportTitle}
        message={t.confirmExportMessage}
        confirmLabel={t.confirmExport}
      />
    </PageShell>
  )
}
