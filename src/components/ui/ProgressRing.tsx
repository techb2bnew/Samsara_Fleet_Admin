/**
 * A ring made of one or more arcs, drawn head to tail clockwise from the top.
 *
 * A list and not a single fraction, because a clock that has been overrun has
 * two things to say: how much was allowed, and how much was taken beyond it.
 * With one fraction the ring showed neither — "hours left" is zero once a
 * limit is passed, so the arc vanished and an overrun clock drew an empty
 * circle.
 *
 * Given both, the ring becomes the whole of what the driver actually did: an
 * eight-hour limit with nine and a half driven is a full circle, of which
 * eight hours' worth is the status colour and the last hour and a half is red.
 *
 * A conic-gradient for the arcs and a radial-gradient mask for the hole, so it
 * is one element and no SVG. The driver app draws the same thing with a
 * stroked circle, because React Native has no gradients without a native
 * module; the two should look the same on both screens.
 */

export type Arc = {
  /** Share of the whole ring, 0 to 1. */
  portion: number
  color: string
}

export function ProgressRing({
  size,
  stroke,
  arcs,
  track = 'var(--color-line)',
}: {
  size: number
  stroke: number
  arcs: Arc[]
  track?: string
}) {
  /* Head to tail, in degrees, with the track filling whatever is left. */
  const stops: string[] = []
  let at = 0
  for (const arc of arcs) {
    const portion = Math.max(0, Math.min(arc.portion, 1 - at))
    if (portion <= 0) continue
    const from = at * 360
    at += portion
    stops.push(`${arc.color} ${from}deg ${at * 360}deg`)
  }
  stops.push(`${track} ${at * 360}deg`)

  const hole = size / 2 - stroke

  return (
    <div
      className="relative rounded-full"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${stops.join(', ')})`,
        /*
         * The hole, punched rather than covered: a filled circle on top would
         * have to know the panel's background, and this ring sits on two
         * different ones.
         */
        mask: `radial-gradient(circle at center, transparent ${hole}px, black ${hole}px)`,
        WebkitMask: `radial-gradient(circle at center, transparent ${hole}px, black ${hole}px)`,
      }}
      aria-hidden="true"
    />
  )
}

/** The ring with a figure in the middle. Two elements, because the mask that
    punches the hole would eat anything drawn inside it. */
export function RingGauge({
  size,
  stroke,
  arcs,
  children,
}: {
  size: number
  stroke: number
  arcs: Arc[]
  children?: React.ReactNode
}) {
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <ProgressRing size={size} stroke={stroke} arcs={arcs} />
      <div className="absolute grid place-items-center">{children}</div>
    </div>
  )
}
