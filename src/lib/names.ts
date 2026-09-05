/**
 * A person's name, the way it should be read.
 *
 * Names arrive as typed. Somebody adding a driver in a hurry types "shubham"
 * and it appears that way in the roster, the hours grid, the dispatch board
 * and every message thread — twelve places built the same string, so there was
 * nowhere to fix it once.
 *
 * ---------------------------------------------------------------------------
 * Only the first letter, and only if it is lower case
 * ---------------------------------------------------------------------------
 * The rest of each part is left exactly as it was typed. Title-casing the
 * whole thing would turn "McDonald" into "Mcdonald" and "O'Brien" into
 * "O'brien" — a correction that is wrong more often than the thing it fixes.
 *
 * Nothing here writes to the database. What somebody typed is what they typed,
 * and a driver whose name genuinely starts lower case (there are such names)
 * still has it stored correctly; only the display is normalised.
 */
function capitalise(part: string): string {
  const clean = part.trim()
  if (!clean) return ''
  return clean.charAt(0).toUpperCase() + clean.slice(1)
}

/** "shubham" + "Kumar" → "Shubham Kumar". Empty parts are dropped, not padded. */
export function personName(first?: string | null, last?: string | null): string {
  return [capitalise(first ?? ''), capitalise(last ?? '')].filter(Boolean).join(' ')
}

/**
 * The same, for a name that is already one string.
 *
 * Office staff have a single `full_name` column, and it is typed by hand at
 * invitation time — so it needs the same treatment as a driver's two.
 */
export function displayName(name?: string | null): string {
  return (name ?? '')
    .trim()
    .split(/\s+/)
    .map(capitalise)
    .filter(Boolean)
    .join(' ')
}
