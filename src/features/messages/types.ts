/**
 * Office-to-driver conversations.
 *
 * A conversation is one driver — see the messaging migration. The thread is a
 * summary of the newest message, built for the list; the messages themselves
 * are loaded per conversation.
 */

export type Thread = {
  /** The driver's id. There is one conversation per driver. */
  id: string
  driver: string
  initials: string
  preview: string
  /** Already formatted. */
  at: string
  /**
   * How many of this driver's messages the office has not read.
   *
   * A count, not a flag. "3" and "1" are different amounts of owed attention,
   * and a dispatcher working down an inbox wants to know which thread has been
   * waiting longest with the most in it.
   */
  unreadCount: number
}

export type Message = {
  id: string
  from: 'driver' | 'office'
  body: string
  /** Already formatted, "07:15". */
  at: string
}
