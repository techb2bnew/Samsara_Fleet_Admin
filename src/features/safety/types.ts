import type { Tone } from '../../constants'

/**
 * Harsh-driving events and their coaching outcome.
 *
 * The coaching response lives on the event itself — see the
 * safety_and_training migration — so `status` carries both "has this been
 * reviewed" and "was coaching given".
 */

export type SafetyEvent = {
  id: string
  driver: string
  initials: string
  /** Worded for the screen: "Harsh braking", "Speeding". */
  kind: string
  severity: 'high' | 'medium' | 'low'
  location: string
  /** Already formatted. */
  at: string
  status: 'new' | 'coachable' | 'dismissed'
}

/**
 * A driver's safety score.
 *
 * Needs a scoring rule over safety events, which does not exist yet, so this
 * is empty on live data rather than showing an invented number.
 */
export type ScoreRow = {
  rank: number
  driver: string
  initials: string
  score: number
  change: number
}

export const SEVERITY_TONE: Record<SafetyEvent['severity'], Tone> = {
  high: 'danger',
  medium: 'warning',
  low: 'neutral',
}

export const SAFETY_STATUS_LABEL: Record<SafetyEvent['status'], string> = {
  new: 'Needs review',
  coachable: 'Coaching assigned',
  dismissed: 'Dismissed',
}
