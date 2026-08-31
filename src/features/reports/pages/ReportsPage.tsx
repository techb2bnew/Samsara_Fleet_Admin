import { STRINGS } from '../../../constants'
import { PageShell, Panel } from '../../../components/layout/PageShell'
import { Button, useToast } from '../../../components/ui'
import { MOCK_REPORTS, type Report } from '../../../mocks/admin'
import { DRIVER_STATUS_LABEL } from '../../../mocks/people'
import { VEHICLE_STATUS_LABEL } from '../../../mocks/vehicles'
import { ROUTE_LABEL } from '../../../mocks/operations'
import { useFleetData } from '../../fleet-data'
import { csvFilename, downloadCsv } from '../../../lib/csv'

const t = STRINGS.reports

const GROUPS: Report['group'][] = ['Fleet', 'Compliance', 'Safety', 'Operations']

/** Module A14. */
export function ReportsPage() {
  const { drivers, vehicles, routes } = useFleetData()
  const { show } = useToast()

  /**
   * Each report exports the data it is actually about. A single generic dump
   * would be quicker to write and useless to read — a utilisation report and a
   * defect report share no columns.
   */
  function runReport(report: Report) {
    let headers: string[] = []
    let rows: Array<Array<unknown>> = []

    switch (report.id) {
      case 'rep1': // Driver utilisation
      case 'rep5': // Working hours summary
        headers = ['Driver', 'Employee number', 'Home terminal', 'Status', 'Hours left', 'Safety score']
        // Labels, not the raw enum values — a manager opens this in a spreadsheet
        // and "on_duty" is not a word.
        rows = drivers.map((d) => [
          d.name, d.employeeNumber, d.terminal, DRIVER_STATUS_LABEL[d.status], d.hoursLeft, d.safetyScore,
        ])
        break
      case 'rep2': // Vehicle utilisation
      case 'rep3': // Idle time
      case 'rep4': // Fuel and mileage
        headers = ['Vehicle', 'Plate', 'Make & model', 'Year', 'Status', 'Odometer (km)', 'Overdue (km)']
        rows = vehicles.map((v) => [
          v.name, v.plate, v.makeModel, v.year, VEHICLE_STATUS_LABEL[v.status], v.odometerKm, v.serviceOverdueKm,
        ])
        break
      case 'rep10': // On-time delivery
        headers = ['Route', 'Driver', 'Vehicle', 'Stops done', 'Stops total', 'Status', 'Timing']
        rows = routes.map((r) => [
          r.reference, r.driver, r.vehicle, r.stopsDone, r.stopsTotal, ROUTE_LABEL[r.status], r.eta,
        ])
        break
      default:
        headers = ['Report', 'Group', 'Generated']
        rows = [[report.name, report.group, new Date().toISOString()]]
    }

    const filename = csvFilename(report.name)
    downloadCsv(filename, headers, rows)
    show(STRINGS.export.started(filename))
  }

  return (
    <PageShell eyebrow="Module A14" title={t.title} description={t.description}>
      <div className="flex flex-col gap-5">
        {GROUPS.map((group) => {
          const reports = MOCK_REPORTS.filter((r) => r.group === group)
          if (reports.length === 0) return null

          return (
            <Panel key={group} title={group}>
              <ul className="divide-y divide-line">
                {reports.map((report) => (
                  <li
                    key={report.id}
                    className="flex flex-wrap items-center gap-4 px-5 py-3.5"
                  >
                    <div className="min-w-[200px] flex-1">
                      <p className="text-[13.5px] font-medium text-ink">{report.name}</p>
                      <p className="mt-0.5 text-[12.5px] text-ink-3">{report.description}</p>
                    </div>
                    <span className="text-[12px] whitespace-nowrap text-ink-4">
                      {t.lastRun(report.lastRun)}
                    </span>
                    <Button size="sm" variant="secondary" onClick={() => runReport(report)}>
                      {t.run}
                    </Button>
                  </li>
                ))}
              </ul>
            </Panel>
          )
        })}
      </div>
    </PageShell>
  )
}
