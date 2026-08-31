/**
 * Greeting for the current time of day.
 *
 * Dispatch offices run around the clock, so a fixed "Good morning" is wrong for
 * most of the people looking at it. Boundaries follow ordinary usage rather
 * than clock quarters: afternoon starts at noon, evening at 17:00, and the
 * small hours get their own greeting instead of being called evening.
 */
export function greetingFor(date: Date = new Date()): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = date.getHours()
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  if (hour < 22) return 'evening'
  return 'night'
}
