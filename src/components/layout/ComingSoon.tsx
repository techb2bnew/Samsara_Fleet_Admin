import { PageShell } from './PageShell'
import { STRINGS } from '../../constants'

/** Placeholder for a module whose screens are not designed yet. */
export function ComingSoon({ name }: { name: string }) {
  return (
    <PageShell title={name}>
      <div className="rounded-[12px] border border-dashed border-line-strong bg-surface px-6 py-14 text-center panel-shadow">
        <p className="text-sm text-ink-3">{STRINGS.console.notDesignedYet}</p>
      </div>
    </PageShell>
  )
}
