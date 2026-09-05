import type { Tone } from '../../constants'

/**
 * A driver as every screen reads them, whichever backend filled the list.
 *
 * Two different things were called "status" before this. They are separate
 * questions with separate answers, and the roster only knows one of them:
 *
 *   employment  is this person on the books — the roster's own answer
 *   duty        are they driving right now — hours of service, from the phone
 *
 * The fields that only hours-of-service or safety scoring can answer are
 * nullable on purpose. Null means "nothing is recording this yet", which the
 * screens show as a dash. A zero or an "off duty" default would read as a fact.
 */

export type DriverEmployment = 'active' | 'inactive' | 'terminated'

export type DriverDuty = 'driving' | 'on_duty' | 'resting' | 'off_duty' | 'offline'

export type Driver = {
  id: string
  name: string
  initials: string
  firstName: string
  lastName: string
  employeeNumber: string
  email: string
  phone: string
  /**
   * The depot they are based at. One field rather than an id beside a name:
   * screens render the name and filters compare the id, and two loose fields
   * drift apart the moment one of them is forgotten.
   */
  depot: { id: string; name: string } | null

  employment: DriverEmployment

  /** Null until duty_status_events is recording. */
  duty: DriverDuty | null
  /** Null until duty_status_events is recording. */
  hoursLeft: string | null
  /** Null until safety events are being scored. */
  safetyScore: number | null

  /** The vehicle they are signed on to right now. */
  vehicle: string | null
  vehicleId: string | null

  licenceExpires: string | null
  /** ISO date the date field reads. Null when nothing is on file. */
  licenceExpiresOn: string | null
  /** Inside the warning window but still valid. */
  licenceWarning: boolean
  /** Past its date. Different from expiring soon, and worse. */
  licenceExpired: boolean

  /** False until the driver has accepted their invitation and signed in. */
  onApp: boolean
}

export const EMPLOYMENT_LABEL: Record<DriverEmployment, string> = {
  active: 'Active',
  inactive: 'Inactive',
  terminated: 'Left',
}

export const EMPLOYMENT_TONE: Record<DriverEmployment, Tone> = {
  active: 'success',
  inactive: 'warning',
  terminated: 'neutral',
}

export const DUTY_LABEL: Record<DriverDuty, string> = {
  driving: 'Driving',
  on_duty: 'On duty',
  resting: 'Resting',
  off_duty: 'Off duty',
  offline: 'Offline',
}

export const DUTY_TONE: Record<DriverDuty, Tone> = {
  driving: 'success',
  on_duty: 'accent',
  resting: 'warning',
  off_duty: 'neutral',
  offline: 'danger',
}
