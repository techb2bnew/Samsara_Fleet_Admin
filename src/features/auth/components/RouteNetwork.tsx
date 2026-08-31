import { useId } from 'react'
import { COLORS } from '../../../constants'
import { usePrefersReducedMotion } from '../../../lib/usePrefersReducedMotion'

/**
 * Ambient background for the signed-out screens: a road network that draws
 * itself in, with vehicles running along it once it has.
 *
 * The subject supplies the artwork rather than an abstract gradient — this is a
 * fleet product, so the thing quietly moving behind the form is a fleet.
 *
 * Two things were wrong with the first version and are deliberate here:
 *
 *   Contrast. On a light ground the strokes had faded to the point of looking
 *   like dust on the screen. They now carry enough weight to read as a drawing.
 *
 *   Composition. Every road crossed near the middle, so the vehicles bunched
 *   into one smudge. The roads now spread across the full frame and the
 *   vehicles are placed on routes that stay apart.
 *
 * Motion is SMIL for the vehicles and CSS for the draw-in. SMIL ignores
 * `prefers-reduced-motion`, so the moving parts are not rendered at all when
 * that is set; the CSS animations are handled by the global rule in index.css.
 */

type Road = { d: string; dash: boolean; delay: number }

/**
 * Roads, drawn for a wide viewport and spread deliberately: two sweeping across
 * the upper half, two across the lower, and two verticals tying them together.
 * Each one runs past the edges so a vehicle enters and leaves rather than
 * appearing out of nothing.
 */
const ROADS: Road[] = [
  { d: 'M -120 250 C 260 190, 520 250, 780 210 S 1280 120, 1720 170', dash: false, delay: 0 },
  { d: 'M -120 690 C 240 720, 480 620, 760 640 S 1240 740, 1720 660', dash: false, delay: 0.25 },
  { d: 'M -120 470 C 300 500, 700 420, 1020 470 S 1420 540, 1720 470', dash: true, delay: 0.9 },
  { d: 'M 300 -80 C 340 220, 240 420, 330 640 S 470 880, 430 1000', dash: false, delay: 0.5 },
  { d: 'M 1180 -80 C 1140 200, 1260 400, 1180 620 S 1060 860, 1120 1000', dash: false, delay: 0.7 },
  { d: 'M 740 1000 C 780 780, 700 600, 800 400 S 900 160, 860 -80', dash: true, delay: 1.1 },
]

/** Depots, spread across the frame rather than clustered at one crossing. */
const NODES = [
  { cx: 330, cy: 470 },
  { cx: 780, cy: 210 },
  { cx: 1180, cy: 470 },
  { cx: 760, cy: 640 },
  { cx: 430, cy: 860 },
  { cx: 1120, cy: 830 },
]

/** One vehicle per road, on routes that keep them apart, at unequal speeds. */
const VEHICLES = [
  { road: 0, dur: '54s', begin: '-4s' },
  { road: 1, dur: '47s', begin: '-21s' },
  { road: 3, dur: '62s', begin: '-11s' },
  { road: 4, dur: '58s', begin: '-34s' },
]

export function RouteNetwork() {
  const uid = useId().replace(/:/g, '')
  const reducedMotion = usePrefersReducedMotion()

  const roadId = (index: number) => `${uid}-road-${index}`

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        {/* Strong through the middle band where the eye rests, quieter at the
            top and bottom so the logo and the footer sit on clean ground. */}
        <linearGradient id={`${uid}-fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={COLORS.brandInk} stopOpacity="0.07" />
          <stop offset="45%" stopColor={COLORS.brandInk} stopOpacity="0.26" />
          <stop offset="100%" stopColor={COLORS.brandInk} stopOpacity="0.07" />
        </linearGradient>

        <radialGradient id={`${uid}-glow`}>
          <stop offset="0%" stopColor={COLORS.accent} stopOpacity="0.7" />
          <stop offset="100%" stopColor={COLORS.accent} stopOpacity="0" />
        </radialGradient>

        {ROADS.map((road, i) => (
          <path key={i} id={roadId(i)} d={road.d} />
        ))}
      </defs>

      {/* Solid roads draw themselves along their length. */}
      <g fill="none" stroke={`url(#${uid}-fade)`} strokeWidth="1.6" strokeLinecap="round">
        {ROADS.map((road, i) =>
          road.dash ? null : (
            <use
              key={i}
              href={`#${roadId(i)}`}
              className="animate-road"
              style={{ animationDelay: `${road.delay}s` }}
            />
          ),
        )}
      </g>

      {/* Dashed roads cannot draw in — their dash pattern is already using
          stroke-dasharray — so they fade in behind the solid ones instead. */}
      <g fill="none" stroke={`url(#${uid}-fade)`} strokeWidth="1.4" strokeLinecap="round">
        {ROADS.map((road, i) =>
          road.dash ? (
            <use
              key={i}
              href={`#${roadId(i)}`}
              strokeDasharray="7 12"
              className="animate-fade"
              style={{ animationDelay: `${road.delay}s` }}
            />
          ) : null,
        )}
      </g>

      {/* Depots appear once the roads they sit on have been drawn. */}
      <g className="animate-fade" style={{ animationDelay: '1.6s' }}>
        {NODES.map((node, i) => (
          <g key={i}>
            <circle
              cx={node.cx}
              cy={node.cy}
              r="9"
              fill={COLORS.brand}
              stroke={COLORS.brandInk}
              strokeOpacity="0.22"
            />
            <circle cx={node.cx} cy={node.cy} r="2.4" fill={COLORS.brandInk} fillOpacity="0.34" />
          </g>
        ))}
      </g>

      {/* Vehicles set off after the network exists. */}
      {!reducedMotion && (
        <g className="animate-fade" style={{ animationDelay: '2s' }}>
          {VEHICLES.map((vehicle, i) => (
            <g key={i}>
              <circle r="18" fill={`url(#${uid}-glow)`}>
                <animateMotion
                  dur={vehicle.dur}
                  begin={vehicle.begin}
                  repeatCount="indefinite"
                  rotate="auto"
                >
                  <mpath href={`#${roadId(vehicle.road)}`} />
                </animateMotion>
              </circle>
              <circle r="3.2" fill={COLORS.accent}>
                <animateMotion
                  dur={vehicle.dur}
                  begin={vehicle.begin}
                  repeatCount="indefinite"
                  rotate="auto"
                >
                  <mpath href={`#${roadId(vehicle.road)}`} />
                </animateMotion>
              </circle>
            </g>
          ))}
        </g>
      )}
    </svg>
  )
}
