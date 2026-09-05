import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { STRINGS } from '../../../constants'
import { Alert, Button, Field, Modal, useToast } from '../../../components/ui'
import { useFleetData } from '../../fleet-data'
import type { Course } from '../types'

const t = STRINGS.training.assignDialog

/**
 * Puts a course on drivers.
 *
 * Multi-select rather than one at a time: training is assigned to a group —
 * everyone at a depot, everyone who has not done it yet — and clicking through
 * forty drivers one by one is how half of them get missed.
 *
 * Drivers who already have it are shown ticked and disabled, so it is obvious
 * who is already covered rather than the office guessing and assigning twice.
 */
export function AssignCourseDialog({
  open,
  course,
  onClose,
}: {
  open: boolean
  course: Course
  onClose: () => void
}) {
  const { drivers, depots, assignCourse } = useFleetData()
  const { show } = useToast()

  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set())
  const [dueOn, setDueOn] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const already = useMemo(
    () => new Set(course.learners.map((l) => l.driverId)),
    [course.learners],
  )

  /** Active drivers only — a terminated driver has no training to do. */
  const eligible = useMemo(
    () => drivers.filter((driver) => driver.employment === 'active'),
    [drivers],
  )

  useEffect(() => {
    if (!open) return
    setPicked(new Set())
    setDueOn('')
    setError(null)
  }, [open])

  function toggle(driverId: string) {
    setPicked((current) => {
      const next = new Set(current)
      if (next.has(driverId)) next.delete(driverId)
      else next.add(driverId)
      return next
    })
  }

  /** Everyone at one depot, minus whoever already has it. */
  function pickDepot(depotId: string) {
    setPicked(
      new Set(
        eligible
          .filter((driver) => driver.depot?.id === depotId && !already.has(driver.id))
          .map((driver) => driver.id),
      ),
    )
  }

  const outstanding = eligible.filter((driver) => !already.has(driver.id))

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (picked.size === 0) {
      setError(t.pickSomeone)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const added = await assignCourse(course.id, [...picked], dueOn || null)
      show(t.assignedToast(added))
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.failed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.title}
      description={t.description(course.name)}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {STRINGS.common.cancel}
          </Button>
          <Button type="submit" form="assign-course-form" loading={saving}>
            {picked.size > 0 ? t.submitCount(picked.size) : t.submit}
          </Button>
        </>
      }
    >
      <form id="assign-course-form" onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="mb-4">
            <Alert tone="danger">{error}</Alert>
          </div>
        )}

        {eligible.length === 0 ? (
          <Alert tone="neutral">{t.noDrivers}</Alert>
        ) : (
          <div className="flex flex-col gap-4">
            <Field
              label={t.dueOn}
              type="date"
              hint={t.dueOnHint}
              value={dueOn}
              onChange={(event) => setDueOn(event.target.value)}
            />

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-medium text-ink-3">{t.quickPick}</span>
              <Button
                size="sm"
                variant="secondary"
                type="button"
                onClick={() => setPicked(new Set(outstanding.map((d) => d.id)))}
              >
                {t.everyoneOutstanding(outstanding.length)}
              </Button>
              {depots.map((depot) => (
                <Button
                  key={depot.id}
                  size="sm"
                  variant="secondary"
                  type="button"
                  onClick={() => pickDepot(depot.id)}
                >
                  {depot.name}
                </Button>
              ))}
            </div>

            <ul className="max-h-[300px] overflow-y-auto rounded-[8px] border border-line">
              {eligible.map((driver) => {
                const has = already.has(driver.id)
                return (
                  <li
                    key={driver.id}
                    className="flex items-center gap-3 border-b border-line px-3 py-2 last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      id={`assign-${driver.id}`}
                      checked={has || picked.has(driver.id)}
                      disabled={has}
                      onChange={() => toggle(driver.id)}
                      className="size-4 shrink-0 accent-accent"
                    />
                    <label
                      htmlFor={`assign-${driver.id}`}
                      className="min-w-0 flex-1 cursor-pointer truncate text-[13.5px] text-ink"
                    >
                      {driver.name}
                      {driver.depot && (
                        <span className="ml-2 text-[12px] text-ink-4">{driver.depot.name}</span>
                      )}
                    </label>
                    {has && <span className="shrink-0 text-[11.5px] text-ink-4">{t.alreadyHas}</span>}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </form>
    </Modal>
  )
}
