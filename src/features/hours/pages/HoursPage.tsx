import { useState } from 'react'
import { STRINGS, TONE_SOLID } from '../../../constants'
import { cn } from '../../../lib/cn'
import { PageShell, Panel } from '../../../components/layout/PageShell'
import { Button, ConfirmDialog, EmptyState, useToast } from '../../../components/ui'
import {
  LOG_DATES,
  LOG_STATE_LABEL,
  LOG_STATE_TONE,
  MOCK_LOGS,
  MOCK_UNASSIGNED,
  type EditRequest,
  type Violation,
} from '../../../mocks/compliance'
import { useFleetData } from '../../fleet-data'
import { csvFilename, downloadCsv } from '../../../lib/csv'

const t = STRINGS.hours

/**
 * Module A06.
 *
 * The grid is the centre of this screen because it answers the compliance
 * officer's real question — "is anything not certified?" — across the whole
 * fleet at a glance, rather than one driver at a time.
 *
 * Every action here changes a legal record, so each one confirms first and says
 * plainly what will happen. Approving a correction in particular does not edit
 * the driver's log: it sends the change to their phone for them to accept,
 * because a carrier may not alter a driver's record on their behalf.
 */
export function HoursPage() {
  const { violations, editRequests, reviewViolation, resolveEditRequest } = useFleetData()
  const { show } = useToast()

  const [reviewing, setReviewing] = useState<Violation | null>(null)
  const [deciding, setDeciding] = useState<{ request: EditRequest; decision: 'approve' | 'reject' } | null>(
    null,
  )
  const [assigned, setAssigned] = useState<string[]>([])

  const openViolations = violations.filter((v) => v.status === 'open')
  const unassigned = MOCK_UNASSIGNED.filter((u) => !assigned.includes(u.id))

  /**
   * The audit pack an inspector asks for: one row per driver per day, with the
   * certification state spelled out rather than left as a colour. A regulator
   * reads this in a spreadsheet, not in the console.
   */
  function exportAuditPack() {
    const rows = MOCK_LOGS.flatMap((log) =>
      log.days.map((state, i) => [log.driver, LOG_DATES[i], LOG_STATE_LABEL[state]]),
    )
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
        <Button size="sm" variant="secondary" onClick={exportAuditPack}>
          {t.exportPack}
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <Panel title={t.gridTitle} hint={t.gridHint}>
          <div className="overflow-x-auto px-5 py-4">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr>
                  <th className="pb-2 text-left text-[11px] font-semibold tracking-[0.07em] text-ink-3 uppercase">
                    Driver
                  </th>
                  {LOG_DATES.map((date) => (
                    <th
                      key={date}
                      className="px-1 pb-2 text-center text-[11px] font-medium whitespace-nowrap text-ink-3"
                    >
                      {date}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MOCK_LOGS.map((log) => (
                  <tr key={log.driverId} className="border-t border-line">
                    <td className="py-2 pr-4 text-[13px] font-medium whitespace-nowrap text-ink">
                      {log.driver}
                    </td>
                    {log.days.map((state, i) => {
                      const tone = LOG_STATE_TONE[state]
                      return (
                        <td key={i} className="px-1 py-2 text-center">
                          <span
                            title={`${LOG_DATES[i]} — ${LOG_STATE_LABEL[state]}`}
                            className={cn(
                              'inline-block h-6 w-full min-w-[26px] rounded-[4px]',
                              tone ? TONE_SOLID[tone] : 'bg-surface-2',
                              tone === 'success' && 'opacity-45',
                            )}
                          />
                          <span className="sr-only">{LOG_STATE_LABEL[state]}</span>
                        </td>
                      )
                    })}
                  </tr>
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
        </Panel>

        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title={t.violationsTitle} hint={t.violationsHint}>
            {violations.length === 0 ? (
              <EmptyState title={t.noViolations} />
            ) : openViolations.length === 0 ? (
              <EmptyState title={t.allViolationsReviewed} />
            ) : (
              <ul className="divide-y divide-line">
                {openViolations.map((violation) => (
                  <li key={violation.id} className="flex items-start gap-3 px-5 py-3.5">
                    <span
                      className={cn('mt-1.5 size-2 shrink-0 rounded-full', TONE_SOLID.danger)}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium text-ink">{violation.type}</p>
                      <p className="mt-0.5 text-[12.5px] text-ink-3">
                        {violation.driver} · {violation.detail}
                      </p>
                      <p className="mt-1 text-[11.5px] text-ink-4">{violation.occurred}</p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => setReviewing(violation)}>
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
                    <li key={request.id} className="px-5 py-3.5">
                      <p className="text-[13.5px] font-medium text-ink">{request.driver}</p>
                      <p className="mt-0.5 text-[12.5px] text-ink-2">{request.requested}</p>
                      <p className="mt-0.5 text-[12px] text-ink-3">&ldquo;{request.reason}&rdquo;</p>
                      <div className="mt-2.5 flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => setDeciding({ request, decision: 'approve' })}
                        >
                          {t.approve}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeciding({ request, decision: 'reject' })}
                        >
                          {t.reject}
                        </Button>
                        <span className="ml-auto text-[11.5px] text-ink-4">{request.date}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title={t.unassignedTitle} hint={t.unassignedHint}>
              {unassigned.length === 0 ? (
                <EmptyState title={t.noUnassigned} />
              ) : (
                <ul className="divide-y divide-line">
                  {unassigned.map((segment) => (
                    <li key={segment.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-medium text-ink">{segment.vehicle}</p>
                        <p className="text-[12.5px] text-ink-3">
                          {segment.period} · {segment.distanceKm} km
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setAssigned((current) => [...current, segment.id])
                          show(t.assignedToast)
                        }}
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

      <ConfirmDialog
        open={reviewing !== null}
        onClose={() => setReviewing(null)}
        onConfirm={() => {
          if (reviewing) {
            reviewViolation(reviewing.id)
            show(t.reviewedToast)
          }
          setReviewing(null)
        }}
        title={t.confirmReviewTitle}
        message={
          reviewing ? t.confirmReviewMessage(reviewing.driver, reviewing.type) : ''
        }
        confirmLabel={t.confirmReview}
      />

      <ConfirmDialog
        open={deciding !== null}
        onClose={() => setDeciding(null)}
        onConfirm={() => {
          if (deciding) {
            resolveEditRequest(deciding.request.id, deciding.decision)
            show(deciding.decision === 'approve' ? t.approvedToast : t.rejectedToast)
          }
          setDeciding(null)
        }}
        title={deciding?.decision === 'reject' ? t.confirmRejectTitle : t.confirmApproveTitle}
        message={
          deciding
            ? deciding.decision === 'reject'
              ? t.confirmRejectMessage(deciding.request.driver)
              : t.confirmApproveMessage(deciding.request.driver)
            : ''
        }
        confirmLabel={deciding?.decision === 'reject' ? t.confirmReject : t.confirmApprove}
        tone={deciding?.decision === 'reject' ? 'danger' : 'primary'}
      />
    </PageShell>
  )
}
