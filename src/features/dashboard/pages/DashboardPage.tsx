import { Link } from 'react-router-dom'
import { STRINGS, TONE_SOLID, TONE_TEXT } from '../../../constants'
import { useAuth } from '../../auth/AuthProvider'
import { MOCK_ACTIVITY, MOCK_ALERTS, MOCK_KPIS, type Kpi } from '../../../mocks/fleet'
import { ArrowRightIcon } from '../../../components/ui'
import { cn } from '../../../lib/cn'
import { greetingFor } from '../../../lib/greeting'

const t = STRINGS.dashboard

/**
 * Module A02.
 *
 * Ordered by what a fleet manager opens the console to find out: what is wrong,
 * then what is running, then what the team has been doing. Problems are at the
 * top because a dashboard that buries them is decoration.
 */
export function DashboardPage() {
  const { session } = useAuth()
  const name = session?.user.fullName ?? ''
  // Recomputed on each render, which is often enough — nobody sits on the
  // dashboard across a greeting boundary and notices it did not change.
  const greeting = t.greetings[greetingFor()]

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-7">
      <header className="mb-6">
        <h1 className="text-[21px] font-semibold tracking-[-0.015em] text-ink">
          {t.greeting(greeting, name)}
        </h1>
        <p className="mt-1 text-[13.5px] text-ink-3">{t.subtitle}</p>
      </header>

      {/* Counts. The three that can be wrong are toned; the rest stay neutral,
          so colour means "look at this" rather than "this is a number". */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {MOCK_KPIS.map((kpi) => (
          <KpiTile key={kpi.id} kpi={kpi} />
        ))}
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.45fr_1fr]">
        {/* ---- alerts ---- */}
        <section className="rounded-[10px] border border-line bg-surface">
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-3.5">
            <div>
              <h2 className="text-[15px] font-semibold text-ink">{t.needsAttention}</h2>
              <p className="mt-0.5 text-[12.5px] text-ink-3">{t.needsAttentionHint}</p>
            </div>
            <span className="shrink-0 rounded-full border border-danger-line bg-danger-soft px-2 py-0.5 text-[11.5px] font-semibold text-danger">
              {MOCK_ALERTS.length}
            </span>
          </div>

          {MOCK_ALERTS.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13.5px] text-ink-3">{t.allClear}</p>
          ) : (
            <ul>
              {MOCK_ALERTS.map((alert) => (
                <li key={alert.id} className="border-b border-line last:border-b-0">
                  <Link
                    to={alert.href}
                    className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2"
                  >
                    <span
                      className={cn('mt-1.5 size-2 shrink-0 rounded-full', TONE_SOLID[alert.tone])}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] leading-snug font-medium text-ink">
                        {alert.title}
                      </span>
                      <span className="mt-0.5 block text-[12.5px] text-ink-3">{alert.detail}</span>
                    </span>
                    <span className="shrink-0 text-[12px] whitespace-nowrap text-ink-4">
                      {alert.at}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---- right column ---- */}
        <div className="flex flex-col gap-5">
          <section className="rounded-[10px] border border-line bg-surface">
            <div className="border-b border-line px-5 py-3.5">
              <h2 className="text-[15px] font-semibold text-ink">{t.quickActions}</h2>
            </div>
            <div className="grid grid-cols-2 gap-2 p-3">
              {/* `?new=1` makes the destination open its form on arrival, so a
                  quick action is one click rather than two. */}
              <QuickAction to="/drivers?new=1" label={t.actions.addDriver} />
              <QuickAction to="/vehicles?new=1" label={t.actions.addVehicle} />
              <QuickAction to="/dispatch?new=1" label={t.actions.planRoute} />
              <QuickAction to="/messages" label={t.actions.messageFleet} />
            </div>
          </section>

          <section className="rounded-[10px] border border-line bg-surface">
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-3.5">
              <div>
                <h2 className="text-[15px] font-semibold text-ink">{t.recentActivity}</h2>
                <p className="mt-0.5 text-[12.5px] text-ink-3">{t.recentActivityHint}</p>
              </div>
            </div>
            <ul className="px-5 py-2">
              {MOCK_ACTIVITY.map((item) => (
                <li key={item.id} className="flex items-start gap-2.5 py-2.5">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[10px] font-semibold text-ink-2">
                    {item.initials}
                  </span>
                  <p className="min-w-0 flex-1 text-[13px] leading-snug text-ink-2">
                    <span className="font-medium text-ink">{item.who}</span> {item.what}
                  </p>
                  <span className="shrink-0 text-[11.5px] text-ink-4">{item.at}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}

function KpiTile({ kpi }: { kpi: Kpi }) {
  return (
    <Link
      to={kpi.href}
      className="group rounded-[10px] border border-line bg-surface px-4 py-3.5 transition-colors hover:border-line-strong"
    >
      <p className="truncate text-[12px] font-medium text-ink-3">{kpi.label}</p>
      <p
        className={cn(
          'mt-1.5 text-[26px] leading-none font-semibold tracking-[-0.02em]',
          kpi.tone ? TONE_TEXT[kpi.tone] : 'text-ink',
        )}
      >
        {kpi.value}
      </p>
      <p className="mt-1.5 truncate text-[11.5px] text-ink-4">{kpi.detail}</p>
    </Link>
  )
}

function QuickAction({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between gap-2 rounded-[7px] border border-line px-3 py-2.5 text-[13px] font-medium text-ink-2 transition-colors hover:border-accent-line hover:bg-accent-soft hover:text-accent"
    >
      <span className="truncate">{label}</span>
      <ArrowRightIcon size={14} className="shrink-0 text-ink-4 group-hover:text-accent" />
    </Link>
  )
}
