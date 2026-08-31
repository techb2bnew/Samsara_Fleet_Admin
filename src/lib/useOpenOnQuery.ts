import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Opens a dialog when the page is reached with a flag in the query string, then
 * strips the flag.
 *
 * This is what makes a quick action work end to end: "Add a driver" on the
 * dashboard navigates to /drivers?new=1, the drivers page opens its form on
 * arrival, and the parameter is removed so a refresh or a back-and-forward does
 * not reopen a form the user already dismissed.
 */
export function useOpenOnQuery(param = 'new'): [boolean, (open: boolean) => void] {
  const [params, setParams] = useSearchParams()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (params.get(param) !== '1') return
    setOpen(true)
    const next = new URLSearchParams(params)
    next.delete(param)
    setParams(next, { replace: true })
  }, [params, param, setParams])

  return [open, setOpen]
}
