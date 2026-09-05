/**
 * One width scale for every table in the console.
 *
 * Each page used to pick its own numbers, so the same kind of cell was a
 * different size on every screen — a status badge was 130px on Drivers, 150 on
 * Vehicles, 140 on Dispatch, 120 on Training. Nobody reads a table and thinks
 * "that badge is twenty pixels wider than the last one", but they do come away
 * feeling the screens were built by different people.
 *
 * ---------------------------------------------------------------------------
 * One column per table has no width, and it should be the identity column
 * ---------------------------------------------------------------------------
 * The table uses automatic layout, so columns without a width share whatever
 * is left — by content, unpredictably. With several of them the slack lands
 * wherever the longest string happens to be, which is why the driver column
 * swelled to a third of the screen while everything after it was cramped.
 *
 * Give every column a width except the one naming the thing — driver, vehicle,
 * route, file — and that column absorbs the slack on a wide screen and gives
 * it back on a narrow one. Which is what it should do: it holds the longest
 * text and it is what somebody scans down.
 */
export const COL = {
  /** A status badge. */
  status: '130px',
  /** A formatted date, with or without a time. */
  date: '140px',
  /** A person's name. */
  person: '170px',
  /** A depot, a vehicle, a role — a short label naming something. */
  place: '150px',
  /** A right-aligned figure with a unit: 12,400 km, 8:30. */
  figure: '110px',
  /** A bare count: 3, 0, 12. */
  count: '90px',
  /** Progress, "3 of 8" with a bar under it. */
  progress: '150px',
  /** The trailing Edit / actions cell. */
  actions: '72px',
} as const
