import { useState } from 'react'
import { STRINGS } from '../../../constants'
import { cn } from '../../../lib/cn'
import { useNotifications } from '../NotificationsProvider'
import { NotificationList } from '../components/NotificationList'

const t = STRINGS.notifications

export function NotificationsPage() {
  const { notifications, unreadCount, markAllRead } = useNotifications()
  const [tab, setTab] = useState<'all' | 'unread'>('all')

  const visible = tab === 'unread' ? notifications.filter((n) => !n.read) : notifications

  return (
    <div className="mx-auto max-w-[820px] px-6 py-7">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[21px] font-semibold tracking-[-0.015em] text-ink">{t.title}</h1>
          <p className="mt-1 text-[13.5px] text-ink-3">{t.pageSubtitle}</p>
        </div>
        <button
          onClick={markAllRead}
          disabled={unreadCount === 0}
          className="rounded-[6px] border border-line-strong bg-surface px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:text-ink-4"
        >
          {t.markAllRead}
        </button>
      </header>

      <div className="mb-3 flex gap-1">
        {(['all', 'unread'] as const).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={cn(
              'rounded-[7px] px-3 py-1.5 text-[13px] font-medium transition-colors',
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

      <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
        <NotificationList items={visible} emptyMessage={t.empty[tab]} />
      </div>
    </div>
  )
}
