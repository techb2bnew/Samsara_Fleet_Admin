import type { Tone } from '../../constants'

/**
 * Vehicle inspections and what they found.
 *
 * An inspection is a form submission — see the inspections_and_forms
 * migration. `type` is which form was filled in, and `status` follows the
 * defects rather than being set by hand: an inspection with an open defect is
 * not resolved no matter what anybody ticked.
 */

export type Inspection = {
  id: string
  vehicle: string
  driver: string
  type: 'Pre-trip' | 'Post-trip' | 'Other'
  /** Already formatted. */
  submitted: string
  defects: number
  status: 'pending' | 'open_defect' | 'resolved'
  /** The worst defect found, for the list. Null when there were none. */
  worstDefect: string | null
}

export type InspectionDefect = {
  id: string
  area: string
  finding: string
  severity: 'critical' | 'major' | 'minor'
  /**
   * Matches the defect_status enum. `dismissed` is not the same as `resolved`
   * and must not be folded into it: resolved means it was fixed, dismissed
   * means somebody looked and it needed nothing. An inspector reading a
   * dismissed brake defect is entitled to ask who decided that.
   */
  status: 'open' | 'in_repair' | 'resolved' | 'dismissed'
  /** The repair job raised for it, when one was. */
  workOrderId: string | null
  /** What was done about it. Null while it is still open. */
  correctiveAction: string | null
  /**
   * Who reported it, and when. Null when it came from an inspection the office
   * already has the driver's name against.
   */
  reportedByName: string | null
  /** Already worded for display. */
  reportedAt: string
}

/**
 * A defect with no inspection behind it: the driver reported the fault on its
 * own. It carries the vehicle because there is no submission row to read it
 * from.
 */
export type ReportedDefect = InspectionDefect & { vehicle: string }

export const INSPECTION_TONE: Record<Inspection['status'], Tone> = {
  pending: 'accent',
  open_defect: 'danger',
  resolved: 'success',
}

export const INSPECTION_LABEL: Record<Inspection['status'], string> = {
  pending: 'Awaiting review',
  open_defect: 'Open defect',
  resolved: 'Resolved',
}

export const DEFECT_TONE: Record<InspectionDefect['severity'], Tone> = {
  critical: 'danger',
  major: 'warning',
  minor: 'neutral',
}

export const DEFECT_LABEL: Record<InspectionDefect['severity'], string> = {
  critical: 'Safety critical',
  major: 'Major',
  minor: 'Minor',
}

export const DEFECT_STATUS_LABEL: Record<InspectionDefect['status'], string> = {
  open: 'Open',
  in_repair: 'In repair',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
}

export const DEFECT_STATUS_TONE: Record<InspectionDefect['status'], Tone> = {
  open: 'danger',
  in_repair: 'warning',
  resolved: 'success',
  dismissed: 'neutral',
}
