import { PageHeader } from './PageHeader'
import { STRINGS } from '../../constants'

/** Placeholder for a module whose screens are not designed yet. */
export function ComingSoon({ id, name }: { id: string; name: string }) {
  return (
    <>
      <PageHeader eyebrow={STRINGS.console.moduleEyebrow(id)} title={name} />
      <div className="px-7 py-8">
        <div className="rounded-[8px] border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
          <p className="text-sm text-ink-3">{STRINGS.console.notDesignedYet}</p>
        </div>
      </div>
    </>
  )
}
