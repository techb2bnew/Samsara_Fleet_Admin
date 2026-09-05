/**
 * The reports the console offers.
 *
 * A fixed catalogue, not data: these eleven are what the product provides, and
 * each one's rows are built from the loaded lists when it is run.
 */

export type Report = {
  id: string
  name: string
  description: string
  group: 'Fleet' | 'Compliance' | 'Safety' | 'Operations'
}

export const REPORTS: Report[] = [
  { id: 'rep1', name: 'Driver utilisation', description: 'Hours worked against hours available, per driver.', group: 'Fleet' },
  { id: 'rep2', name: 'Vehicle utilisation', description: 'Distance and time in service, per vehicle.', group: 'Fleet' },
  { id: 'rep3', name: 'Idle time', description: 'Engine on, vehicle stationary, by depot.', group: 'Fleet' },
  { id: 'rep4', name: 'Fuel and mileage', description: 'Consumption against distance, with outliers flagged.', group: 'Fleet' },
  { id: 'rep5', name: 'Working hours summary', description: 'Hours logged and remaining, per driver per week.', group: 'Compliance' },
  { id: 'rep6', name: 'Violation trends', description: 'Breaches by type over time.', group: 'Compliance' },
  { id: 'rep7', name: 'Defect trends', description: 'Faults found by vehicle area and severity.', group: 'Compliance' },
  { id: 'rep8', name: 'Safety scores', description: 'Driver scores and movement over the period.', group: 'Safety' },
  { id: 'rep9', name: 'Training completion', description: 'Assigned, completed and overdue courses.', group: 'Safety' },
  { id: 'rep10', name: 'On-time delivery', description: 'Stops made inside their arrival window.', group: 'Operations' },
  { id: 'rep11', name: 'Document compliance', description: 'Paperwork captured against stops completed.', group: 'Operations' },
]
