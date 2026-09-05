/**
 * Short courses and how the fleet is getting through them.
 *
 * The counts are computed from course_assignments, never stored on the course:
 * "overdue" depends on today's date, and a stored number would be wrong by
 * tomorrow morning.
 */

export type Course = {
  id: string
  name: string
  /** What the driver reads in the app. Null when the course is a file only. */
  description: string | null
  /**
   * Storage path of the material, not a URL — the bucket is private, so a
   * stored URL would be dead within the hour.
   */
  contentPath: string | null
  lengthMinutes: number | null
  assigned: number
  completed: number
  overdue: number
  status: 'published' | 'draft'
  /** The depot it is assigned to, or every driver. */
  assignTo: string
  /**
   * Who has it, and how far through they are. Real rows from
   * course_assignments — the detail screen used to invent this list.
   */
  learners: Learner[]
}

export type Learner = {
  assignmentId: string
  driverId: string
  driverName: string
  status: 'assigned' | 'in_progress' | 'completed' | 'overdue'
  /** ISO date, or null when no deadline was set. */
  dueOn: string | null
  /**
   * Seconds the driver has actually had the course open, across pauses.
   *
   * Shown because the status cannot tell "watching it now" apart from "opened
   * it once in April and never came back".
   */
  secondsSpent: number
}
