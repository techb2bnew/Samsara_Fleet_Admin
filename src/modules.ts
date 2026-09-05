import { STRINGS } from './constants'

/**
 * The admin modules, and where they sit in the sidebar.
 *
 * `id` is the reference code from the scope document. Names come from STRINGS
 * so the sidebar, the page headers and any future translation all read from
 * one place.
 */
export type ModuleGroup = keyof typeof STRINGS.moduleGroups

export type Module = {
  id: keyof typeof STRINGS.modules
  path: string
  name: string
  /**
   * The heading it sits under, or none.
   *
   * The dashboard has none. It is the home page rather than a category, and
   * giving it a heading of its own meant a group of one — a header earning its
   * space by labelling nothing.
   */
  group: ModuleGroup | null
}

/*
 * Thirteen entries under four headings.
 *
 * It was six headings, which is a header for roughly every two rows: the
 * sidebar read as more label than list. Two of them had lost their reason to
 * exist. People held nothing but Training once Safety was switched off, and
 * Overview was a heading over two pages that answer different questions.
 *
 * What each heading means now:
 *
 *   (none)      the home page
 *   Fleet       who and what you manage — the people and the trucks
 *   Compliance  what the law asks for, and what runs out
 *   Operations  what is happening today
 *   Admin       running the console itself
 *
 * And the moves that follow from it:
 *
 *   Training   → Fleet, because it is about drivers, who are already there
 *   Documents  → Compliance. What the office DOES with that screen is watch
 *                licences and insurance expire; trip paperwork lives there
 *                too, but the expiry is the work
 *   Live map   → Operations, because "where is everyone right now" is the
 *                question dispatch is asking, not an overview of anything
 */
const DEFINITIONS: Array<Omit<Module, 'name'>> = [
  { id: 'A02', path: '/', group: null },

  { id: 'A04', path: '/drivers', group: 'Fleet' },
  { id: 'A05', path: '/vehicles', group: 'Fleet' },
  { id: 'A12', path: '/training', group: 'Fleet' },

  { id: 'A06', path: '/hours', group: 'Compliance' },
  { id: 'A07', path: '/inspections', group: 'Compliance' },
  { id: 'A13', path: '/documents', group: 'Compliance' },

  { id: 'A03', path: '/map', group: 'Operations' },
  { id: 'A08', path: '/dispatch', group: 'Operations' },
  // Form builder (A09) — held back for the second build. The screens, the
  // strings and the forms/form_submissions tables are all still here; only the
  // sidebar entry and its two routes are switched off. Uncomment this line and
  // the matching block in app/routes.tsx to bring it back.
  // { id: 'A09', path: '/forms', group: 'Operations' },
  { id: 'A10', path: '/messages', group: 'Operations' },

  // Safety & coaching (A11) — switched off, like the form builder above.
  // safety_events has no source: the rows come from telematics hardware —
  // a dashcam or an ELD box detecting harsh braking, speeding, cornering —
  // and this fleet has none. A phone cannot stand in for it either; that
  // needs continuous accelerometer and speed monitoring, which costs a
  // battery a shift.
  //
  // So the screen could only ever say "No matches", and the scoreboard under
  // it could only ever say nothing is scoring them. The pages, the strings
  // and the table are all still here — uncomment this line and the matching
  // block in app/routes.tsx the day there is hardware feeding it.
  // { id: 'A11', path: '/safety', group: 'People' },

  { id: 'A14', path: '/reports', group: 'Admin' },
  { id: 'A01', path: '/users', group: 'Admin' },
  { id: 'A15', path: '/settings', group: 'Admin' },
]

export const MODULES: Module[] = DEFINITIONS.map((d) => ({
  ...d,
  name: STRINGS.modules[d.id],
}))

/** The modules that sit above the first heading, with none of their own. */
export const UNGROUPED: Module[] = MODULES.filter((m) => m.group === null)

export const GROUPS = Object.keys(STRINGS.moduleGroups) as ModuleGroup[]
