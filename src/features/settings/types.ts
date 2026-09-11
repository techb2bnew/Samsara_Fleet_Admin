/**
 * Organisation settings, notification rules and the audit trail.
 */

/*
 * OrgSettings is NOT declared here.
 *
 * There were two of them — this one and the live one in FleetDataProvider,
 * which is what the context actually carries. Two declarations of the same
 * settings shape is one that gets updated and one that quietly does not, so
 * the unused copy is gone rather than kept in step by hand.
 */

/** A rule book a fleet wrote for itself. Minutes throughout. */
export type RuleBook = {
  id: string
  name: string
  dailyDriving: number
  /** Null where the fleet's rules have no on-duty window, like the EU's. */
  dutyWindow: number | null
  drivingBeforeBreak: number
  breakLength: number
  cycle: number
  cycleDays: number
  /*
   * Consecutive minutes off duty required before driving again. Null where
   * the fleet's rules have no such requirement.
   */
  dailyRest: number | null
  /* A fleet's own shift rules. Null on both legal regimes. */
  minWorkBeforeBreak: number | null
  maxBreak: number | null
  maxOnDuty: number | null
}

export type RuleBookDraft = Omit<RuleBook, 'id'>

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
