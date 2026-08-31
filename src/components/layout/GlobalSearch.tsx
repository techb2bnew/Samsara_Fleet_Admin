import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { STRINGS, TONE_SOLID } from '../../constants'
import { cn } from '../../lib/cn'
import { useDismissable } from '../../lib/useDismissable'
import { SearchIcon } from '../ui'
import { useFleetData } from '../../features/fleet-data'
import { DRIVER_STATUS_TONE, DRIVER_STATUS_LABEL } from '../../mocks/people'
import { VEHICLE_STATUS_TONE, VEHICLE_STATUS_LABEL } from '../../mocks/vehicles'
import { ROUTE_TONE, ROUTE_LABEL } from '../../mocks/operations'

const t = STRINGS.console

type Result = {
  id: string
  group: keyof typeof t.searchGroups
  label: string
  detail: string
  tone: string
  href: string
}

/**
 * Search across every module from the header.
 *
 * Results are grouped by what they are, because "Truck 214" and "Ravi
 * Deshmukh" both being in one flat list forces the reader to work out which is
 * which. A hard cap per group keeps the panel a glance rather than a page.
 */
const PER_GROUP = 4

export function GlobalSearch() {
  const navigate = useNavigate()
  const { drivers, vehicles, routes, staff } = useFleetData()

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const ref = useDismissable<HTMLDivElement>(open, close)

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []

    const out: Result[] = []

    for (const driver of drivers) {
      if (
        driver.name.toLowerCase().includes(q) ||
        driver.employeeNumber.toLowerCase().includes(q)
      ) {
        out.push({
          id: `d-${driver.id}`,
          group: 'drivers',
          label: driver.name,
          detail: `${driver.employeeNumber} · ${DRIVER_STATUS_LABEL[driver.status]}`,
          tone: TONE_SOLID[DRIVER_STATUS_TONE[driver.status]],
          href: `/drivers/${driver.id}`,
        })
      }
    }

    for (const vehicle of vehicles) {
      if (vehicle.name.toLowerCase().includes(q) || vehicle.plate.toLowerCase().includes(q)) {
        out.push({
          id: `v-${vehicle.id}`,
          group: 'vehicles',
          label: vehicle.name,
          detail: `${vehicle.plate} · ${VEHICLE_STATUS_LABEL[vehicle.status]}`,
          tone: TONE_SOLID[VEHICLE_STATUS_TONE[vehicle.status]],
          href: `/vehicles/${vehicle.id}`,
        })
      }
    }

    for (const route of routes) {
      if (
        route.reference.toLowerCase().includes(q) ||
        route.driver.toLowerCase().includes(q)
      ) {
        out.push({
          id: `r-${route.id}`,
          group: 'routes',
          label: route.reference,
          detail: `${route.driver} · ${ROUTE_LABEL[route.status]}`,
          tone: TONE_SOLID[ROUTE_TONE[route.status]],
          href: `/dispatch/${route.id}`,
        })
      }
    }

    for (const user of staff) {
      if (user.name.toLowerCase().includes(q) || user.email.toLowerCase().includes(q)) {
        out.push({
          id: `u-${user.id}`,
          group: 'staff',
          label: user.name,
          detail: `${user.role} · ${user.email}`,
          tone: TONE_SOLID.accent,
          href: '/users',
        })
      }
    }

    return out
  }, [query, drivers, vehicles, routes, staff])

  const grouped = useMemo(() => {
    const groups: Array<[keyof typeof t.searchGroups, Result[]]> = []
    for (const key of ['drivers', 'vehicles', 'routes', 'staff'] as const) {
      const items = results.filter((r) => r.group === key).slice(0, PER_GROUP)
      if (items.length > 0) groups.push([key, items])
    }
    return groups
  }, [results])

  function goTo(result: Result) {
    navigate(result.href)
    setQuery('')
    setOpen(false)
  }

  const showPanel = open && query.trim().length > 0

  return (
    <div ref={ref} className="relative max-w-md flex-1">
      <SearchIcon
        size={16}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-4"
      />
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder={t.searchPlaceholder}
        aria-label={t.searchPlaceholder}
        className="h-9 w-full rounded-[7px] border border-line bg-ground pr-3 pl-9 text-[13.5px] text-ink placeholder:text-ink-4 focus:border-accent focus:bg-surface"
      />

      {showPanel && (
        <div className="absolute top-full left-0 z-30 mt-1.5 w-full min-w-[340px] overflow-hidden rounded-[10px] border border-line bg-surface shadow-xl shadow-black/20">
          {query.trim().length < 2 ? (
            <p className="px-4 py-6 text-center text-[13px] text-ink-3">{t.searchHint}</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-ink-3">
              {t.searchNoResults(query.trim())}
            </p>
          ) : (
            <>
              <div className="max-h-[380px] overflow-y-auto">
                {grouped.map(([group, items]) => (
                  <div key={group}>
                    <p className="border-b border-line bg-surface-2 px-4 py-1.5 text-[10.5px] font-semibold tracking-[0.1em] text-ink-4 uppercase">
                      {t.searchGroups[group]}
                    </p>
                    <ul>
                      {items.map((result) => (
                        <li key={result.id}>
                          <button
                            onClick={() => goTo(result)}
                            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-surface-2"
                          >
                            <span
                              className={cn('size-2 shrink-0 rounded-full', result.tone)}
                              aria-hidden="true"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-medium text-ink">
                                {result.label}
                              </span>
                              <span className="block truncate text-[12px] text-ink-3">
                                {result.detail}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="border-t border-line px-4 py-2 text-[11.5px] text-ink-4">
                {t.searchCount(results.length)}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
