import type { RuleViolation } from './rules'

/**
 * How each rule reads on screen.
 *
 * Separate from the engine so the engine stays about the arithmetic, and
 * separate from STRINGS because these are keyed by rule kind rather than by
 * screen — the same wording appears in the violations panel, the driver's
 * profile and a CSV export.
 */
export const VIOLATION_WORDS: Record<RuleViolation['kind'], string> = {
  daily_driving: 'Daily driving limit',
  duty_window: 'On-duty window',
  missing_break: 'Missing break',
  cycle: 'Cycle limit',
  daily_rest: 'Daily rest',
  /* Named as the fleet's own, so nobody reads one as a regulation. */
  break_too_early: 'Break taken too early (fleet rule)',
  break_too_long: 'Break ran too long (fleet rule)',
  on_duty_too_long: 'Too long on duty, not driving (fleet rule)',
}

export const VIOLATION_DETAIL: Record<RuleViolation['kind'], string> = {
  daily_driving: 'Drove longer in one day than the rules allow',
  duty_window: 'Shift ran past the on-duty window',
  missing_break: 'Drove past the break threshold without a qualifying rest',
  cycle: 'On duty for more hours across the cycle than the rules allow',
  daily_rest: 'Started driving without the consecutive hours off duty the rules require',
  break_too_early: 'Stopped for a break before working the time this fleet requires first',
  break_too_long: 'A single break ran longer than this fleet allows',
  on_duty_too_long: 'Spent longer on duty without driving than this fleet allows',
}
