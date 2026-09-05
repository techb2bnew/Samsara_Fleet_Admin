/**
 * Organisation settings, notification rules and the audit trail.
 */

export type OrgSettings = {
  name: string
  country: string
  timezone: string
  /**
   * Which rule book the driver app works to. Empty means the office has not
   * chosen, and the app shows a dash for every hours clock.
   *
   * Only these values: the app parses the string strictly and the column has a
   * check constraint to match. It used to be free text, which meant a typo
   * silently turned off hours calculation for every driver.
   */
  regulator: '' | 'FMCSA' | 'EU'
}

export type AlertRule = {
  id: string
  name: string
  detail: string
  /** Already worded, "Email, in-app". */
  channels: string
  on: boolean
}

export type AuditEntry = {
  id: string
  who: string
  initials: string
  action: string
  target: string
  /** Already formatted. */
  at: string
}
