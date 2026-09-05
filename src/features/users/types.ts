import type { Tone } from '../../constants'

/**
 * Office staff, as the users screen reads them.
 *
 * The list is two things stitched together, and it has to be: an accepted
 * account and a pending invitation are both "someone who has access", and an
 * admin managing access needs to see them in one place.
 *
 *   active     an account with a live role grant
 *   invited    an invitation sent, not yet accepted
 *   suspended  a grant that was revoked; the account still exists
 */

export type StaffStatus = 'active' | 'invited' | 'suspended'

export type StaffUser = {
  id: string
  name: string
  initials: string
  email: string
  /** Role name as the console shows it, e.g. "Dispatcher". */
  role: string
  /** The depot they are scoped to, or every one of them. */
  fleet: string
  status: StaffStatus
  /** Already formatted. "Never signed in" when they have not. */
  lastActive: string
}

export const STAFF_STATUS_TONE: Record<StaffStatus, Tone> = {
  active: 'success',
  invited: 'accent',
  suspended: 'neutral',
}

/** A role the console can grant, and how many people hold it. */
export type Role = {
  key: string
  name: string
  description: string
  people: number
}
