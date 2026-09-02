import { Link } from 'react-router-dom'
import { STRINGS, TONE_SOLID, TONE_TEXT } from '../../../constants'
import { useAuth } from '../../auth/AuthProvider'
import { useDashboard } from '../useDashboard'
import type { Kpi } from '../types'
import {
  ArrowRightIcon,
  MapIcon,
  MessageIcon,
  RouteIcon,
  TruckIcon,
  UserIcon,
} from '../../../components/ui'
import { cn } from '../../../lib/cn'
import { greetingFor } from '../../../lib/greeting'
import { Alert as AlertBanner, Button } from '../../../components/ui'

const t = STRINGS.dashboard

const ACTIONS = [
  { to: '/drivers?new=1', label: t.actions.addDriver, icon: UserIcon },
  { to: '/vehicles?new=1', label: t.actions.addVehicle, icon: TruckIcon },
  { to: '/dispatch?new=1', label: t.actions.planRoute, icon: RouteIcon },
  { to: '/messages', label: t.actions.messageFleet, icon: MessageIcon },
] as const

/**
 * Module A02.
 *
 * Ordered by what a fleet manager opens the console to find out: what is wrong,
 * then what is running, then what the team has been doing. Problems are at the
 * top because a dashboard that buries them is decoration.
 */
export function DashboardPage() {
  const { session } = useAuth()
  const { status, data, error, activityUnavailable, reload } = useDashboard()
  const kpis = data?.kpis ?? []
  const alerts = data?.alerts ?? []
  const activity = data?.activity ?? []
  const name = session?.user.fullName ?? ''
  const greeting = t.greetings[greetingFor()]
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-56"
        style={{
          background:
            'linear-gradient(180deg, color-mix(in srgb, var(--color-accent) 10%, var(--color-ground)), transparent)',
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[12.5px] font-medium text-ink-3">{today}</p>
            <h1 className="mt-1 text-[22px] leading-tight font-semibold tracking-[-0.03em] text-ink sm:text-[26px]">
              {t.greeting(greeting, name)}
            </h1>
            <p className="mt-1.5 text-[13.5px] text-ink-3">{t.subtitle}</p>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-ok-line bg-ok-soft px-2.5 py-1 text-[12px] font-medium text-ok">
              <span className="size-1.5 rounded-full bg-ok" aria-hidden="true" />
              {t.liveNow}
            </span>
            <Link
              to="/map"
              className="inline-flex h-9 items-center gap-1.5 rounded-[7px] border border-accent bg-accent px-3.5 text-[13px] font-medium text-on-accent hover:bg-accent-hover"
            >
              <MapIcon size={15} />
              {t.openMap}
            </Link>
          </div>
        </header>

        {status === 'error' && (
          <div className="mb-5" role="alert">
            <AlertBanner tone="danger" title={t.live.loadFailed}>
              <div className="flex flex-wrap items-center gap-3">
                <span>{error}</span>
                <Button size="sm" variant="secondary" onClick={reload}>
                  {STRINGS.common.retry}
                </Button>
              </div>
            </AlertBanner>
          </div>
        )}

        {/* auto-fit, not a fixed six: the live tile set varies with what the
            fleet has, and a hard six-column grid leaves the seventh tile
            stranded alone on a second row. */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(148px,1fr))]">
          {status === 'loading'
            ? Array.from({ length: 6 }, (_, i) => <KpiSkeleton key={i} />)
            : kpis.map((kpi) => <KpiTile key={kpi.id} kpi={kpi} />)}
        </section>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.45fr_1fr]">
          <section className="overflow-hidden rounded-[12px] border border-line bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-4 sm:gap-4 sm:px-5">
              <div>
                <h2 className="text-[15px] font-semibold text-ink">{t.needsAttention}</h2>
                <p className="mt-0.5 text-[12.5px] text-ink-3">{t.needsAttentionHint}</p>
              </div>
              <span className="shrink-0 rounded-full border border-danger-line bg-danger-soft px-2 py-0.5 text-[11.5px] font-semibold text-danger">
                {status === 'ready' ? alerts.length : '—'}
              </span>
            </div>

            {status === 'loading' ? (
              <p className="px-5 py-10 text-center text-[13.5px] text-ink-3">{t.live.loading}</p>
            ) : status === 'error' ? (
              <p className="px-5 py-10 text-center text-[13.5px] text-ink-3">
                {t.live.alertsUnknown}
              </p>
            ) : alerts.length === 0 ? (
              <p className="px-5 py-10 text-center text-[13.5px] text-ink-3">{t.allClear}</p>
            ) : (
              <ul>
                {alerts.map((alert) => (
                  <li key={alert.id} className="border-b border-line last:border-b-0">
                    <Link
                      to={alert.href}
                      className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2 sm:px-5"
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

          <div className="flex flex-col gap-5">
            <section className="overflow-hidden rounded-[12px] border border-line bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="border-b border-line px-5 py-4">
                <h2 className="text-[15px] font-semibold text-ink">{t.quickActions}</h2>
              </div>
              <div className="grid grid-cols-2 gap-2 p-3">
                {ACTIONS.map((action) => (
                  <QuickAction key={action.to} {...action} />
                ))}
              </div>
            </section>

            <section className="overflow-hidden rounded-[12px] border border-line bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="border-b border-line px-5 py-4">
                <h2 className="text-[15px] font-semibold text-ink">{t.recentActivity}</h2>
                <p className="mt-0.5 text-[12.5px] text-ink-3">{t.recentActivityHint}</p>
              </div>
              {activity.length === 0 ? (
                <p className="px-5 py-8 text-center text-[13px] text-ink-3">
                  {activityUnavailable ? t.live.activityUnavailable : t.allClear}
                </p>
              ) : (
              <ul className="px-5 py-2">
                {activity.map((item) => (
                  <li key={item.id}>
                    <Link
                      to={item.href}
                      className="flex items-start gap-2.5 py-2.5 transition-colors hover:text-ink"
                    >
                      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[10.5px] font-semibold text-accent">
                        {item.initials}
                      </span>
                      <p className="min-w-0 flex-1 text-[13px] leading-snug text-ink-2">
                        <span className="font-medium text-ink">{item.who}</span> {item.what}
                      </p>
                      <span className="shrink-0 text-[11.5px] text-ink-4">{item.at}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Placeholder tile: same height as a real one, so the grid does not jump. */
function KpiSkeleton() {
  return (
    <div
      className="rounded-[12px] border border-line bg-surface px-3 py-3 sm:px-4 sm:py-4"
      aria-hidden="true"
    >
      <div className="h-3 w-2/3 animate-pulse rounded bg-surface-2" />
      <div className="mt-3 h-7 w-1/2 animate-pulse rounded bg-surface-2" />
      <div className="mt-3 h-2.5 w-3/4 animate-pulse rounded bg-surface-2" />
    </div>
  )
}

function KpiTile({ kpi }: { kpi: Kpi }) {
  return (
    <Link
      to={kpi.href}
      className="group relative overflow-hidden rounded-[12px] border border-line bg-surface px-3 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:border-line-strong hover:shadow-[0_10px_24px_-16px_rgba(15,23,42,0.18)] sm:px-4 sm:py-4"
    >
      {kpi.tone && (
        <span
          className={cn('absolute inset-y-0 left-0 w-[3px]', TONE_SOLID[kpi.tone])}
          aria-hidden="true"
        />
      )}
      <p className="truncate text-[12px] font-medium text-ink-3">{kpi.label}</p>
      <p
        className={cn(
          'mt-2 text-[22px] leading-none font-semibold tracking-[-0.03em] sm:text-[28px]',
          kpi.tone ? TONE_TEXT[kpi.tone] : 'text-ink',
        )}
      >
        {kpi.value}
      </p>
      <p className="mt-2 truncate text-[11.5px] text-ink-4">{kpi.detail}</p>
    </Link>
  )
}

function QuickAction({
  to,
  label,
  icon: Icon,
}: {
  to: string
  label: string
  icon: typeof UserIcon
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-2.5 rounded-[9px] border border-line px-3 py-2.5 text-[13px] font-medium text-ink-2 transition-colors hover:border-accent-line hover:bg-accent-soft hover:text-accent"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[7px] bg-surface-2 text-ink-2 group-hover:bg-surface group-hover:text-accent">
        <Icon size={15} />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ArrowRightIcon size={14} className="shrink-0 text-ink-4 group-hover:text-accent" />
    </Link>
  )
}
