import { cn } from '../../../lib/cn'
import { usePrefersReducedMotion } from '../../../lib/usePrefersReducedMotion'

/**
 * Login ground: northern light.
 *
 * Soft vertical curtains of colour that drift, the way sky does at dawn.
 * Nothing to read — no map, no ink blobs, no vehicles.
 */

const CURTAINS = [
  { left: '-4%', width: '34%', delay: '0s', dur: '14s', name: 'a' },
  { left: '22%', width: '28%', delay: '-4s', dur: '18s', name: 'b' },
  { left: '48%', width: '32%', delay: '-8s', dur: '16s', name: 'c' },
  { left: '72%', width: '30%', delay: '-2s', dur: '20s', name: 'd' },
]

const SPARKS = [
  { left: '12%', top: '24%', delay: '0s' },
  { left: '31%', top: '58%', delay: '-1.4s' },
  { left: '44%', top: '18%', delay: '-2.8s' },
  { left: '61%', top: '42%', delay: '-0.6s' },
  { left: '78%', top: '28%', delay: '-3.2s' },
  { left: '19%', top: '72%', delay: '-2.1s' },
  { left: '86%', top: '64%', delay: '-1.1s' },
  { left: '53%', top: '76%', delay: '-4s' },
]

export function LightField() {
  const reduced = usePrefersReducedMotion()

  return (
    <div className="auth-aurora">
      {CURTAINS.map((curtain) => (
        <span
          key={curtain.name}
          className={cn('auth-aurora-curtain', `auth-aurora-curtain-${curtain.name}`, !reduced && 'is-live')}
          style={{
            left: curtain.left,
            width: curtain.width,
            animationDelay: curtain.delay,
            animationDuration: curtain.dur,
          }}
        />
      ))}

      {!reduced &&
        SPARKS.map((spark, i) => (
          <span
            key={i}
            className="auth-aurora-spark"
            style={{ left: spark.left, top: spark.top, animationDelay: spark.delay }}
          />
        ))}
    </div>
  )
}
