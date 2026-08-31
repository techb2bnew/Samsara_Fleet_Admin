import { useEffect, useState } from 'react'

/**
 * Tracks the operating system's "reduce motion" setting.
 *
 * CSS animations are already handled by a global rule in index.css, but SVG
 * `animateMotion` is not affected by it — it has to be left unrendered instead.
 * Anything that moves via SMIL needs to check this hook.
 *
 * Starts as `false` so the first paint matches the common case, then corrects
 * itself on mount.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)

    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}
