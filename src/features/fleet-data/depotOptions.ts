import { useMemo } from 'react'
import { STRINGS } from '../../constants'
import { useFleetData } from './FleetDataProvider'

/**
 * Options for a depot picker, built from the depots in the database.
 *
 * Five dialogs need this list and each one used to build it itself, from a
 * `string[]` of names — so the value saved was a name, and renaming a depot
 * detached everything assigned to it. The value here is always the depot's id.
 *
 * What an empty value MEANS differs by dialog, and that difference matters
 * enough to be a parameter rather than a default:
 *
 *   a driver or vehicle    empty = based at no depot
 *   an invitation          empty = may see every depot
 *   a form or course       empty = assigned to every driver
 *
 * Passing the wrong one here would silently widen an invitation from one depot
 * to the whole company, so the caller has to say which it means.
 */
export function useDepotOptions(emptyLabel: string) {
  const { depots } = useFleetData()

  return useMemo(
    () => [
      // When there are no depots at all the empty option says so and points at
      // where to make one, rather than offering a choice of nothing.
      { value: '', label: depots.length === 0 ? STRINGS.dialog.noDepots : emptyLabel },
      ...depots.map((depot) => ({ value: depot.id, label: depot.name })),
    ],
    [depots, emptyLabel],
  )
}
