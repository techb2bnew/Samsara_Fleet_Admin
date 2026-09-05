import { useMemo, useState } from 'react'
import { STRINGS } from '../../../constants'
import { PageShell, Panel } from '../../../components/layout/PageShell'
import { Button, FilterChips, useToast } from '../../../components/ui'
import { REPORTS, type Report } from '../reports'
import { DUTY_LABEL, EMPLOYMENT_LABEL } from '../../drivers/types'
import { VEHICLE_STATUS_LABEL } from '../../vehicles/types'
import { ROUTE_LABEL } from '../../dispatch/types'
import { useFleetData } from '../../fleet-data'
import { csvFilename, downloadCsv } from '../../../lib/csv'

const t = STRINGS.reports

const GROUPS: Report['group'][] = ['Fleet', 'Compliance', 'Safety', 'Operations']
/** "all", or a depot id from the database. */
type DepotFilter = 'all' | (string & {})

/** Module A14. */
export function ReportsPage() {
  const { drivers, vehicles, routes, courses, inspections, documents, violations, depots } = useFleetData()
  const { show } = useToast()
  const [depot, setDepot] = useState<DepotFilter>('all')

  /*
   * Filtered on the depot's id, not its name. It used to match on the name
   * held in drivers.home_terminal, so renaming a depot dropped every driver
   * in it out of every report — silently, with the report still generating.
   */
  const depotId = depot === 'all' ? null : depot
  const scopedDrivers = useMemo(
    () => (depotId ? drivers.filter((d) => d.depot?.id === depotId) : drivers),
    [drivers, depotId],
  )
  const driverNames = useMemo(() => new Set(scopedDrivers.map((d) => d.name)), [scopedDrivers])
  /*
   * A vehicle is in scope when it is kept at the depot. Its driver is a
   * fallback for vehicles with no depot recorded, which is most of them until
   * the fleet has been through the depot picker once.
   */
  const scopedVehicles = useMemo(
    () =>
      depotId
        ? vehicles.filter((v) =>
            v.depot ? v.depot.id === depotId : !v.driver || driverNames.has(v.driver),
          )
        : vehicles,
    [vehicles, depotId, driverNames],
  )
  const scopedRoutes = useMemo(
    () => (depotId ? routes.filter((r) => driverNames.has(r.driver)) : routes),
    [routes, depotId, driverNames],
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
        headers = ['Driver', 'Employee number', 'Depot', 'Employment', 'Duty', 'Hours left', 'Safety score']
        // A dash, not a blank: an inspector reading this should see that the
        // figure is not recorded rather than wonder if it is zero.
        rows = scopedDrivers.map((d) => [
          d.name, d.employeeNumber, d.depot?.name ?? '—', EMPLOYMENT_LABEL[d.employment],
          d.duty ? DUTY_LABEL[d.duty] : '—', d.hoursLeft ?? '—', d.safetyScore ?? '—',
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
        rows = violations.filter((v) => driverNames.has(v.driver)).map((v) => [
          v.type, v.driver, v.vehicle, v.occurred, v.status,
        ])
        break
      case 'rep7':
        headers = ['Vehicle', 'Driver', 'Type', 'Submitted', 'Defects', 'Worst defect', 'Status']
        rows = inspections.filter((i) => driverNames.has(i.driver)).map((i) => [
          i.vehicle, i.driver, i.type, i.submitted, i.defects, i.worstDefect ?? '—', i.status,
        ])
        break
      case 'rep8':
        headers = ['Driver', 'Safety score', 'Employment', 'Depot']
        rows = scopedDrivers.map((d) => [
          d.name, d.safetyScore ?? '—', EMPLOYMENT_LABEL[d.employment], d.depot?.name ?? '—',
        ])
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
        rows = documents.filter((d) => driverNames.has(d.driver)).map((d) => [
          d.name, d.kind, d.driver, d.vehicle, d.uploaded, d.sizeKb,
        ])
        break
      default:
        headers = ['Report', 'Group', 'Generated']
        rows = [[report.name, report.group, new Date().toISOString()]]
    }

    // An empty spreadsheet reads as "we have no such records", which is not
    // what "nothing has been recorded yet" means.
    if (rows.length === 0) {
      show(t.nothingToRun(report.name))
      return
    }

    const filename = csvFilename(report.name)
    downloadCsv(filename, headers, rows)
    show(STRINGS.export.started(filename))
  }

  return (
    <PageShell title={t.title} description={t.description}>
      <div className="flex flex-col gap-5">
        <div role="group" aria-label={t.depotAria}>
          <FilterChips
            value={depot}
            onChange={setDepot}
            options={[
              { value: 'all', label: t.depots.all },
              ...depots.map((d) => ({ value: d.id, label: d.name })),
            ]}
          />
        </div>
        {GROUPS.map((group) => {
          const reports = REPORTS.filter((r) => r.group === group)
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
