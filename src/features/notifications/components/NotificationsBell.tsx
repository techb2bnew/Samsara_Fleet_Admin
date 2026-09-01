import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { STRINGS } from '../../../constants'
import { cn } from '../../../lib/cn'
import { useDismissable } from '../../../lib/useDismissable'
import { BellIcon } from '../../../components/ui'
import { useNotifications } from '../NotificationsProvider'
import { NotificationList } from './NotificationList'

const t = STRINGS.notifications

/**
 * Bell in the console header, with the notification panel hanging off it.
 *
 * On a phone the panel is pinned to the viewport, not to the bell. Anchoring
 * it to the trigger with a 400px width pushes it off the left edge of a
 * 390-wide screen.
 */
export function NotificationsBell() {
  const { notifications, unreadCount, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'all' | 'unread'>('all')

  const close = useCallback(() => setOpen(false), [])
  const ref = useDismissable<HTMLDivElement>(open, close)

  const visible = tab === 'unread' ? notifications.filter((n) => !n.read) : notifications

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          unreadCount > 0 ? `${t.open}, ${t.unreadCount(unreadCount)}` : t.open
        }
        className={cn(
          'relative flex size-9 items-center justify-center rounded-[8px] transition-colors',
          open ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
        )}
      >
        <BellIcon size={18} />
        {unreadCount > 0 && (
          <span
            className="absolute top-1.5 right-1.5 flex min-w-[15px] items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-[15px] font-semibold text-on-danger"
            aria-hidden="true"
          >
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t.title}
          className="fixed inset-x-3 top-[3.75rem] z-40 flex max-h-[min(32rem,calc(100dvh-5rem))] flex-col overflow-hidden rounded-[12px] border border-line bg-surface shadow-xl shadow-black/10 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-1.5 sm:w-[400px]"
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-[14.5px] font-semibold text-ink">{t.title}</h2>
              <p className="mt-0.5 text-[12px] text-ink-3">
                {unreadCount > 0 ? t.unreadCount(unreadCount) : t.allRead}
              </p>
            </div>

            <button
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="shrink-0 rounded-[5px] px-1.5 py-0.5 text-[12.5px] font-medium text-accent transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:text-ink-4 disabled:hover:bg-transparent"
            >
              {t.markAllRead}
            </button>
          </div>

          <div className="flex shrink-0 gap-1 border-b border-line px-3 py-2">
            {(['all', 'unread'] as const).map((key) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                aria-pressed={tab === key}
                className={cn(
                  'rounded-full px-2.5 py-1 text-[12.5px] font-medium transition-colors',
                  tab === key
                    ? 'bg-accent-soft text-accent'
                    : 'text-ink-3 hover:bg-surface-2 hover:text-ink',
                )}
              >
                {t.tabs[key]}
                {key === 'unread' && unreadCount > 0 && (
                  <span className="ml-1.5 text-ink-4">{unreadCount}</span>
                )}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <NotificationList
              items={visible}
              emptyMessage={t.empty[tab]}
              onNavigate={close}
              dense
            />
          </div>

          <div className="shrink-0 border-t border-line px-4 py-2.5 text-center">
            <Link
              to="/notifications"
              onClick={close}
              className="text-[12.5px] font-medium text-accent hover:underline"
            >
              {t.viewAll}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
