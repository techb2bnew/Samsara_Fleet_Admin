/**
 * Colours that stay readable on a light map, far enough apart that two routes
 * on the same screen are not mistaken for one line.
 *
 * Assigned from the route id, not from list order, so a route that was rust
 * yesterday is still rust after another one is planned.
 */
const PALETTE = [
  '#1D6FD0',
  '#C45C26',
  '#0F7B6C',
  '#7C3AED',
  '#B45309',
  '#BE185D',
  '#365314',
  '#0E7490',
]

export function colorForRoute(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

/** Same palette as `colorForRoute`, but no two ids on the same map share a colour. */
export function colorsForRoutes(ids: string[]): Record<string, string> {
  const taken = new Set<string>()
  const out: Record<string, string> = {}
  for (const id of ids) {
    let color = colorForRoute(id)
    if (taken.has(color)) color = PALETTE.find((entry) => !taken.has(entry)) ?? color
    taken.add(color)
    out[id] = color
  }
  return out
}
