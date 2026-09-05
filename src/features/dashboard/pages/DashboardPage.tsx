import { Link } from 'react-router-dom'
import { STRINGS, TONE_SOLID, TONE_SURFACE, TONE_TEXT } from '../../../constants'
import { useAuth } from '../../auth/AuthProvider'
import { useDashboard, type FeedState } from '../useDashboard'
import type { Kpi } from '../types'
import {
  ArrowRightIcon,
  CheckIcon,
  ClipboardIcon,
  ClockIcon,
  FileIcon,
  MapIcon,
  MessageIcon,
  RouteIcon,
  ShieldIcon,
  TruckIcon,
  UserIcon,
  UsersIcon,
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

const KPI_ICON: Record<string, typeof UserIcon> = {
  'drivers-active': UserIcon,
  'vehicles-active': TruckIcon,
  'out-of-service': ShieldIcon,
  'expiring-docs': FileIcon,
  'service-due': ClockIcon,
  'work-orders': ClipboardIcon,
  'drivers-no-login': UsersIcon,
}

/**
 * Module A02.
 *
 * Ordered by what a fleet manager opens the console to find out: what is wrong,
 * then what is running, then what the team has been doing. Problems are at the
 * top because a dashboard that buries them is decoration.
 */
export function DashboardPage() {
  const { session } = useAuth()
  const { status, data, error, feed, activityUnavailable, reload } = useDashboard()
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
        className="pointer-events-none absolute inset-x-0 top-0 h-72"
        style={{
          background:
            'radial-gradient(ellipse 80% 70% at 8% 0%, color-mix(in srgb, var(--color-accent) 16%, transparent), transparent 58%), linear-gradient(180deg, color-mix(in srgb, var(--color-accent) 8%, var(--color-ground)), transparent)',
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-6 overflow-hidden rounded-[18px] border border-line bg-surface panel-shadow">
          <div
            className="h-1.5"
            style={{
              background:
                'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-warn) 70%, var(--color-accent)))',
            }}
            aria-hidden="true"
          />
          <div className="flex flex-wrap items-end justify-between gap-4 px-4 py-5 sm:px-6">
            <div className="min-w-0">
              <p className="text-[12.5px] font-medium tracking-[0.04em] text-ink-3 uppercase">
                {today}
              </p>
              <h1 className="mt-1 text-[24px] leading-tight font-semibold tracking-[-0.035em] text-ink sm:text-[30px]">
                {t.greeting(greeting, name)}
              </h1>
              <p className="mt-1.5 max-w-xl text-[13.5px] text-ink-3">{t.subtitle}</p>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Judged on the newest position report, not always on. A green
                  dot over a feed that stopped hours ago is worse than no dot. */}
              <FeedBadge feed={feed} />
              <Link
                to="/map"
                className="inline-flex h-10 items-center gap-1.5 rounded-[9px] border border-accent bg-accent px-4 text-[13px] font-medium text-on-accent shadow-[0_8px_18px_-10px_color-mix(in_srgb,var(--color-accent)_70%,transparent)] hover:bg-accent-hover"
              >
                <MapIcon size={15} />
                {t.openMap}
              </Link>
            </div>
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

        {/* minmax is small on purpose: seven tiles must share one row on a
            laptop. A 168px floor was wrapping the last tile onto a lonely
            second line. */}
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(112px,1fr))]">
          {status === 'loading'
            ? Array.from({ length: 6 }, (_, i) => <KpiSkeleton key={i} />)
            : kpis.map((kpi) => <KpiTile key={kpi.id} kpi={kpi} />)}
        </section>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.45fr_1fr]">
          <section className="overflow-hidden rounded-[14px] border border-line bg-surface panel-shadow">
            <div className="flex items-start justify-between gap-3 border-b border-line bg-surface-2/45 px-4 py-4 sm:gap-4 sm:px-5">
              <div>
                <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-ink">
                  {t.needsAttention}
                </h2>
                <p className="mt-0.5 text-[12.5px] text-ink-3">{t.needsAttentionHint}</p>
              </div>
              <span className="shrink-0 rounded-full border border-danger-line bg-danger-soft px-2.5 py-0.5 text-[11.5px] font-semibold text-danger">
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
              <div className="flex flex-col items-center px-5 py-12 text-center">
                <span className="flex size-11 items-center justify-center rounded-full border border-ok-line bg-ok-soft text-ok">
                  <CheckIcon size={20} />
                </span>
                <p className="mt-3 text-[13.5px] font-medium text-ink">{t.allClear}</p>
              </div>
            ) : (
              <ul>
                {alerts.map((alert) => (
                  <li key={alert.id} className="border-b border-line last:border-b-0">
                    <Link
                      to={alert.href}
                      className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-[color-mix(in_srgb,var(--color-accent)_6%,var(--color-surface))] sm:px-5"
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[8px] border',
                          TONE_SURFACE[alert.tone],
                        )}
                        aria-hidden="true"
                      >
                        <span className={cn('size-2 rounded-full', TONE_SOLID[alert.tone])} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] leading-snug font-medium text-ink">
                          {alert.title}
                        </span>
                        <span className="mt-0.5 block text-[12.5px] text-ink-3">{alert.detail}</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11.5px] whitespace-nowrap text-ink-3">
                        {alert.at}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="flex flex-col gap-5">
            <section className="overflow-hidden rounded-[14px] border border-line bg-surface panel-shadow">
              <div className="border-b border-line bg-surface-2/45 px-5 py-4">
                <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-ink">
                  {t.quickActions}
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-2.5 p-3.5">
                {ACTIONS.map((action) => (
                  <QuickAction key={action.to} {...action} />
                ))}
              </div>
            </section>

            <section className="overflow-hidden rounded-[14px] border border-line bg-surface panel-shadow">
              <div className="border-b border-line bg-surface-2/45 px-5 py-4">
                <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-ink">
                  {t.recentActivity}
                </h2>
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
                        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">
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

/**
 * Says whether positions are actually arriving.
 *
 * "Live" is a claim about right now, so it is only made when something
 * reported inside the window the live map uses for the same judgement.
 */
function FeedBadge({ feed }: { feed: FeedState }) {
  if (feed === null) return null

  const label =
    feed === 'live' ? t.feed.live : feed === 'stale' ? t.feed.stale : t.feed.silent
  const tone =
    feed === 'live'
      ? 'border-ok-line bg-ok-soft text-ok'
      : feed === 'stale'
        ? 'border-warn-line bg-warn-soft text-warn'
        : 'border-line bg-surface-2 text-ink-3'
  const dot = feed === 'live' ? 'bg-ok' : feed === 'stale' ? 'bg-warn' : 'bg-ink-4'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[12px] font-medium',
        tone,
      )}
    >
      <span className={cn('size-1.5 rounded-full', dot)} aria-hidden="true" />
      {label}
    </span>
  )
}

function KpiSkeleton() {
  return (
    <div
      className="rounded-[10px] border border-line bg-surface px-2.5 py-2.5"
      aria-hidden="true"
    >
      <div className="size-6 animate-pulse rounded-[6px] bg-surface-2" />
      <div className="mt-2.5 h-5 w-1/2 animate-pulse rounded bg-surface-2" />
      <div className="mt-2 h-2 w-3/4 animate-pulse rounded bg-surface-2" />
    </div>
  )
}

function KpiTile({ kpi }: { kpi: Kpi }) {
  const Icon = KPI_ICON[kpi.id] ?? GridFallback
  const well = kpi.tone ? TONE_SURFACE[kpi.tone] : 'border-accent-line bg-accent-soft text-accent'

  return (
    <Link
      to={kpi.href}
      className="group relative overflow-hidden rounded-[10px] border border-line bg-surface px-2.5 py-2.5 shadow-[0_1px_2px_rgba(22,20,16,0.04)] transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-[0_10px_20px_-16px_rgba(22,20,16,0.28)]"
    >
      {kpi.tone && (
        <span
          className={cn('absolute inset-y-0 left-0 w-[2px]', TONE_SOLID[kpi.tone])}
          aria-hidden="true"
        />
      )}
      <span
        className={cn(
          'flex size-6 items-center justify-center rounded-[6px] border',
          well,
        )}
      >
        <Icon size={13} />
      </span>
      <p className="mt-2 truncate text-[10px] font-medium tracking-[0.04em] text-ink-3 uppercase">
        {kpi.label}
      </p>
      <p
        className={cn(
          'mt-1 text-[22px] leading-none font-semibold tracking-[-0.04em]',
          kpi.tone ? TONE_TEXT[kpi.tone] : 'text-ink',
        )}
      >
        {kpi.value}
      </p>
      <p className="mt-1 truncate text-[10.5px] text-ink-4">{kpi.detail}</p>
    </Link>
  )
}

/** Used only if a new tile id is added before an icon is wired. */
function GridFallback(props: { size?: number }) {
  return <ClipboardIcon size={props.size} />
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
      className="group flex flex-col gap-3 rounded-[12px] border border-line bg-ground/60 px-3.5 py-3.5 text-[13px] font-medium text-ink-2 transition-colors hover:border-accent-line hover:bg-accent-soft hover:text-accent"
    >
      <span className="flex size-9 items-center justify-center rounded-[9px] bg-surface text-ink-2 shadow-[0_1px_2px_rgba(22,20,16,0.06)] group-hover:bg-accent group-hover:text-on-accent">
        <Icon size={16} />
      </span>
      <span className="flex items-end justify-between gap-2">
        <span className="min-w-0 leading-snug">{label}</span>
        <ArrowRightIcon size={14} className="mb-0.5 shrink-0 text-ink-4 group-hover:text-accent" />
      </span>
    </Link>
  )
}
