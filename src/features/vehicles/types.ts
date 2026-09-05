import type { Tone } from '../../constants'

/**
 * A vehicle and a repair job, as every screen reads them.
 *
 * Trucks and trailers are the same table — see the lean_pass migration. `kind`
 * is what tells them apart, and it matters on screen: a trailer has no
 * odometer, no service interval and never reports a position, so showing it a
 * "next service in 8,000 km" column would be nonsense.
 */

export type VehicleKind = 'truck' | 'trailer'

export type VehicleStatus = 'active' | 'in_maintenance' | 'out_of_service' | 'retired'

export type Vehicle = {
  id: string
  kind: VehicleKind
  name: string
  plate: string
  /** Null when nobody recorded one. */
  vin: string | null
  makeModel: string
  /** Null when nobody recorded one. */
  year: number | null
  status: VehicleStatus
  /** The driver signed on to it right now. */
  driver: string | null
  driverId: string | null
  /** The depot it is kept at. */
  depot: { id: string; name: string } | null
  odometerKm: number
  /**
   * From the active maintenance schedule. Null when the vehicle has no
   * schedule — which is normal for a trailer, and a gap worth seeing for a
   * truck.
   */
  nextServiceKm: number | null
  /** How far past due it is. Zero when it is not due. */
  serviceOverdueKm: number
}

export type WorkOrderStatus = 'open' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'

export type WorkOrder = {
  id: string
  reference: string
  vehicle: string
  title: string
  status: WorkOrderStatus
  mechanic: string | null
  /** Already formatted for display. */
  opened: string
  costRupees: number
  /** Set when a driver raised this from the app, rather than the office. */
  requestedByDriverName: string | null
  /** What was actually written when it was raised. Most of what a request is. */
  description: string | null
  /** Already formatted. Null while the job is still open. */
  completed: string | null
  /** The faults it was raised against, if any. */
  defects: Array<{ id: string; area: string; finding: string; severity: string }>
}

export const VEHICLE_STATUS_LABEL: Record<VehicleStatus, string> = {
  active: 'Active',
  in_maintenance: 'In maintenance',
  out_of_service: 'Out of service',
  retired: 'Retired',
}

export const VEHICLE_STATUS_TONE: Record<VehicleStatus, Tone> = {
  active: 'success',
  in_maintenance: 'warning',
  out_of_service: 'danger',
  retired: 'neutral',
}

export const WORK_ORDER_LABEL: Record<WorkOrderStatus, string> = {
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const WORK_ORDER_TONE: Record<WorkOrderStatus, Tone> = {
  open: 'danger',
  assigned: 'warning',
  in_progress: 'accent',
  completed: 'success',
  cancelled: 'neutral',
}
