import { useEffect, useState, type FormEvent } from 'react'
import { STRINGS } from '../../../constants'
import { Alert, Button, Field, Modal } from '../../../components/ui'
import { useFleetData } from '../../fleet-data'
import type { RuleBook, RuleBookDraft } from '../types'

const t = STRINGS.settings.ruleBook

/**
 * Writes a fleet's own rule book.
 *
 * ---------------------------------------------------------------------------
 * Hours and minutes, not decimals
 * ---------------------------------------------------------------------------
 * A single "hours" box invites 4.5 for four and a half — and invites 4.3 for
 * four thirty, which is eighteen minutes out and looks perfectly reasonable on
 * the way in. Two boxes cannot be misread. The EU's 4h30 break threshold is
 * exactly the case that makes this worth the extra field.
 *
 * The warning at the top is not decoration. Everything below feeds the
 * violations engine and the remaining-hours clocks a driver reads before
 * deciding whether to keep driving, and nothing checks these numbers against
 * any statute — that is the whole point of the feature and also its risk.
 */

type Span = { h: string; m: string }

function toSpan(minutes: number | null): Span {
  if (minutes === null) return { h: '', m: '' }
  return { h: String(Math.floor(minutes / 60)), m: String(minutes % 60) }
}

/** Null when both boxes are empty, so "no such limit" stays expressible. */
function fromSpan(span: Span): number | null {
  const h = span.h.trim()
  const m = span.m.trim()
  if (!h && !m) return null
  return (Number(h) || 0) * 60 + (Number(m) || 0)
}

type Draft = {
  name: string
  dailyDriving: Span
  hasDutyWindow: boolean
  dutyWindow: Span
  drivingBeforeBreak: Span
  breakLength: string
  cycle: Span
  cycleDays: string
}

/*
 * FMCSA's numbers, as a starting point.
 *
 * A blank form is a worse start than a real rule book: most fleets writing
 * their own are adjusting one of the two regimes rather than inventing hours
 * from nothing, and starting from something valid means the first save cannot
 * fail on a box somebody did not know was required.
 */
const EMPTY: Draft = {
  name: '',
  dailyDriving: { h: '11', m: '0' },
  hasDutyWindow: true,
  dutyWindow: { h: '14', m: '0' },
  drivingBeforeBreak: { h: '8', m: '0' },
  breakLength: '30',
  cycle: { h: '70', m: '0' },
  cycleDays: '8',
}

function draftFrom(book: RuleBook): Draft {
  return {
    name: book.name,
    dailyDriving: toSpan(book.dailyDriving),
    hasDutyWindow: book.dutyWindow !== null,
    dutyWindow: toSpan(book.dutyWindow ?? 0),
    drivingBeforeBreak: toSpan(book.drivingBeforeBreak),
    breakLength: String(book.breakLength),
    cycle: toSpan(book.cycle),
    cycleDays: String(book.cycleDays),
  }
}

/** A pair of boxes for one span of time. */
function SpanField({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string
  hint?: string
  value: Span
  onChange: (next: Span) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-ink">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          inputMode="numeric"
          aria-label={`${label} — ${t.hours}`}
          value={value.h}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, h: e.target.value })}
          className="h-9.5 w-16 rounded-[6px] border border-line-strong bg-surface px-2 text-sm text-ink focus:border-accent disabled:opacity-50"
        />
        <span className="text-[13px] text-ink-3">{t.hours}</span>
        <input
          type="number"
          min={0}
          max={59}
          inputMode="numeric"
          aria-label={`${label} — ${t.minutes}`}
          value={value.m}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, m: e.target.value })}
          className="h-9.5 w-16 rounded-[6px] border border-line-strong bg-surface px-2 text-sm text-ink focus:border-accent disabled:opacity-50"
        />
        <span className="text-[13px] text-ink-3">{t.minutes}</span>
      </div>
      {hint && <p className="text-[13px] text-ink-3">{hint}</p>}
    </div>
  )
}

export function RuleBookDialog({
  open,
  book,
  onClose,
  onSaved,
}: {
  open: boolean
  /** Null when adding. */
  book: RuleBook | null
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const { addRuleBook, saveRuleBook } = useFleetData()

  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setDraft(book ? draftFrom(book) : EMPTY)
    setError(null)
  }, [open, book])

  async function submit(event: FormEvent) {
    event.preventDefault()

    const dailyDriving = fromSpan(draft.dailyDriving)
    const drivingBeforeBreak = fromSpan(draft.drivingBeforeBreak)
    const cycle = fromSpan(draft.cycle)

    /*
     * Only the "did you fill it in" check happens here. Whether the numbers
     * make sense together is the database's answer — the constraints there are
     * the ones that cannot be bypassed by a second client, and duplicating
     * their logic in the form is how the two drift apart.
     */
    if (!draft.name.trim() || dailyDriving === null || drivingBeforeBreak === null || cycle === null) {
      setError(t.failed)
      return
    }

    const next: RuleBookDraft = {
      name: draft.name,
      dailyDriving,
      dutyWindow: draft.hasDutyWindow ? fromSpan(draft.dutyWindow) : null,
      drivingBeforeBreak,
      breakLength: Number(draft.breakLength) || 0,
      cycle,
      cycleDays: Number(draft.cycleDays) || 0,
    }

    setSaving(true)
    setError(null)
    try {
      if (book) {
        await saveRuleBook(book.id, next)
        onSaved(t.updated)
      } else {
        await addRuleBook(next)
        onSaved(t.created)
      }
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.failed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={book ? t.editTitle : t.addTitle}
      description={t.hint}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {STRINGS.common.cancel}
          </Button>
          <Button type="submit" form="rule-book-form" loading={saving}>
            {t.save}
          </Button>
        </>
      }
    >
      <form id="rule-book-form" onSubmit={submit} className="grid gap-4">
        <Alert tone="warning">{t.warning}</Alert>

        {error && (
          <div role="alert">
            <Alert tone="danger">{error}</Alert>
          </div>
        )}

        <Field
          label={t.name}
          placeholder={t.namePlaceholder}
          value={draft.name}
          required
          onChange={(e) => setDraft((c) => ({ ...c, name: e.target.value }))}
        />

        <SpanField
          label={t.dailyDriving}
          value={draft.dailyDriving}
          onChange={(dailyDriving) => setDraft((c) => ({ ...c, dailyDriving }))}
        />

        <div className="grid gap-1.5">
          <label className="flex items-center gap-2 text-[13px] text-ink">
            <input
              type="checkbox"
              checked={!draft.hasDutyWindow}
              onChange={(e) => setDraft((c) => ({ ...c, hasDutyWindow: !e.target.checked }))}
            />
            {t.dutyWindowNone}
          </label>
          <SpanField
            label={t.dutyWindow}
            hint={t.dutyWindowHint}
            value={draft.dutyWindow}
            disabled={!draft.hasDutyWindow}
            onChange={(dutyWindow) => setDraft((c) => ({ ...c, dutyWindow }))}
          />
        </div>

        <SpanField
          label={t.beforeBreak}
          value={draft.drivingBeforeBreak}
          onChange={(drivingBeforeBreak) => setDraft((c) => ({ ...c, drivingBeforeBreak }))}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t.breakLength}
            hint={t.breakLengthUnit}
            type="number"
            min={0}
            value={draft.breakLength}
            onChange={(e) => setDraft((c) => ({ ...c, breakLength: e.target.value }))}
          />
          <Field
            label={t.cycleDays}
            hint={t.cycleDaysUnit}
            type="number"
            min={1}
            value={draft.cycleDays}
            onChange={(e) => setDraft((c) => ({ ...c, cycleDays: e.target.value }))}
          />
        </div>

        <SpanField
          label={t.cycle}
          value={draft.cycle}
          onChange={(cycle) => setDraft((c) => ({ ...c, cycle }))}
        />
      </form>
    </Modal>
  )
}
