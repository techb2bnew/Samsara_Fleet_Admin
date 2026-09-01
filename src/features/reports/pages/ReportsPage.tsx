import { useMemo, useState } from 'react'
import { STRINGS } from '../../../constants'
import { PageShell, Panel } from '../../../components/layout/PageShell'
import { Button, FilterChips, useToast } from '../../../components/ui'
import { MOCK_REPORTS, type Report } from '../../../mocks/admin'
import { DRIVER_STATUS_LABEL } from '../../../mocks/people'
import { VEHICLE_STATUS_LABEL } from '../../../mocks/vehicles'
import { ROUTE_LABEL } from '../../../mocks/operations'
import { MOCK_DOCUMENTS } from '../../../mocks/operations'
import { MOCK_INSPECTIONS, MOCK_VIOLATIONS } from '../../../mocks/compliance'
import { useFleetData } from '../../fleet-data'
import { csvFilename, downloadCsv } from '../../../lib/csv'

const t = STRINGS.reports

const GROUPS: Report['group'][] = ['Fleet', 'Compliance', 'Safety', 'Operations']
type Depot = 'all' | 'pune' | 'nashik'

/** Module A14. */
export function ReportsPage() {
  const { drivers, vehicles, routes, courses } = useFleetData()
  const { show } = useToast()
  const [depot, setDepot] = useState<Depot>('all')

  const terminal = depot === 'pune' ? 'Pune depot' : depot === 'nashik' ? 'Nashik depot' : null
  const scopedDrivers = useMemo(
    () => (terminal ? drivers.filter((d) => d.terminal === terminal) : drivers),
    [drivers, terminal],
  )
  const driverNames = useMemo(() => new Set(scopedDrivers.map((d) => d.name)), [scopedDrivers])
  const scopedVehicles = useMemo(
    () =>
      terminal
        ? vehicles.filter((v) => !v.driver || driverNames.has(v.driver))
        : vehicles,
    [vehicles, terminal, driverNames],
  )
  const scopedRoutes = useMemo(
    () => (terminal ? routes.filter((r) => driverNames.has(r.driver)) : routes),
    [routes, terminal, driverNames],
  )

  /**
   * Each report exports the data it is actually about. A single generic dump
   * would be quicker to write and useless to read — a utilisation report and a
   * defect report share no columns.
   */
  function runReport(report: Report) {
    let headers: string[] = []
    let rows: Array<Array<unknown>> = []

    switch (report.id) {
      case 'rep1':
      case 'rep5':
        headers = ['Driver', 'Employee number', 'Home terminal', 'Status', 'Hours left', 'Safety score']
        rows = scopedDrivers.map((d) => [
          d.name, d.employeeNumber, d.terminal, DRIVER_STATUS_LABEL[d.status], d.hoursLeft, d.safetyScore,
        ])
        break
      case 'rep2':
      case 'rep3':
      case 'rep4':
        headers = ['Vehicle', 'Plate', 'Make & model', 'Year', 'Status', 'Odometer (km)', 'Overdue (km)']
        rows = scopedVehicles.map((v) => [
          v.name, v.plate, v.makeModel, v.year, VEHICLE_STATUS_LABEL[v.status], v.odometerKm, v.serviceOverdueKm,
        ])
        break
      case 'rep6':
        headers = ['Type', 'Driver', 'Vehicle', 'When', 'Status']
        rows = MOCK_VIOLATIONS.filter((v) => driverNames.has(v.driver)).map((v) => [
          v.type, v.driver, v.vehicle, v.occurred, v.status,
        ])
        break
      case 'rep7':
        headers = ['Vehicle', 'Driver', 'Type', 'Submitted', 'Defects', 'Worst defect', 'Status']
        rows = MOCK_INSPECTIONS.filter((i) => driverNames.has(i.driver)).map((i) => [
          i.vehicle, i.driver, i.type, i.submitted, i.defects, i.worstDefect ?? '—', i.status,
        ])
        break
      case 'rep8':
        headers = ['Driver', 'Safety score', 'Status', 'Home terminal']
        rows = scopedDrivers.map((d) => [d.name, d.safetyScore, DRIVER_STATUS_LABEL[d.status], d.terminal])
        break
      case 'rep9':
        headers = ['Course', 'Length (min)', 'Assigned', 'Completed', 'Overdue', 'Status']
        rows = courses.map((c) => [c.name, c.lengthMinutes, c.assigned, c.completed, c.overdue, c.status])
        break
      case 'rep10':
        headers = ['Route', 'Driver', 'Vehicle', 'Stops done', 'Stops total', 'Status', 'Timing']
        rows = scopedRoutes.map((r) => [
          r.reference, r.driver, r.vehicle, r.stopsDone, r.stopsTotal, ROUTE_LABEL[r.status], r.eta,
        ])
        break
      case 'rep11':
        headers = ['File', 'Type', 'Driver', 'Vehicle', 'Uploaded', 'Size (KB)']
        rows = MOCK_DOCUMENTS.filter((d) => driverNames.has(d.driver)).map((d) => [
          d.name, d.kind, d.driver, d.vehicle, d.uploaded, d.sizeKb,
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
        <div role="group" aria-label={t.depotAria}>
          <FilterChips
            value={depot}
            onChange={setDepot}
            options={[
              { value: 'all', label: t.depots.all },
              { value: 'pune', label: t.depots.pune },
              { value: 'nashik', label: t.depots.nashik },
            ]}
          />
        </div>
        {GROUPS.map((group) => {
          const reports = MOCK_REPORTS.filter((r) => r.group === group)
          if (reports.length === 0) return null

          return (
            <Panel key={group} title={group}>
              <ul className="divide-y divide-line">
                {reports.map((report) => (
                  <li
                    key={report.id}
                    className="flex flex-wrap items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-2"
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
