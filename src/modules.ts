import { STRINGS } from './constants'

/**
 * The 15 admin modules.
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
  group: ModuleGroup
}

const DEFINITIONS: Array<Omit<Module, 'name'>> = [
  { id: 'A02', path: '/', group: 'Overview' },
  { id: 'A03', path: '/map', group: 'Overview' },

  { id: 'A04', path: '/drivers', group: 'Fleet' },
  { id: 'A05', path: '/vehicles', group: 'Fleet' },

  { id: 'A06', path: '/hours', group: 'Compliance' },
  { id: 'A07', path: '/inspections', group: 'Compliance' },

  { id: 'A08', path: '/dispatch', group: 'Operations' },
  // Form builder (A09) — held back for the second build. The screens, the
  // strings and the forms/form_submissions tables are all still here; only the
  // sidebar entry and its two routes are switched off. Uncomment this line and
  // the matching block in app/routes.tsx to bring it back.
  // { id: 'A09', path: '/forms', group: 'Operations' },
  { id: 'A10', path: '/messages', group: 'Operations' },
  { id: 'A13', path: '/documents', group: 'Operations' },

  { id: 'A11', path: '/safety', group: 'People' },
  { id: 'A12', path: '/training', group: 'People' },

  { id: 'A14', path: '/reports', group: 'Admin' },
  { id: 'A01', path: '/users', group: 'Admin' },
  { id: 'A15', path: '/settings', group: 'Admin' },
]

export const MODULES: Module[] = DEFINITIONS.map((d) => ({
  ...d,
  name: STRINGS.modules[d.id],
}))

export const GROUPS = Object.keys(STRINGS.moduleGroups) as ModuleGroup[]
