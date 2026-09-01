import { useState } from 'react'
import { STRINGS } from '../../../constants'
import { cn } from '../../../lib/cn'
import { PageShell } from '../../../components/layout/PageShell'
import { Button } from '../../../components/ui'
import { useNotifications } from '../NotificationsProvider'
import { NotificationList } from '../components/NotificationList'

const t = STRINGS.notifications

export function NotificationsPage() {
  const { notifications, unreadCount, markAllRead } = useNotifications()
  const [tab, setTab] = useState<'all' | 'unread'>('all')

  const visible = tab === 'unread' ? notifications.filter((n) => !n.read) : notifications

  return (
    <PageShell
      width="narrow"
      title={t.title}
      description={t.pageSubtitle}
      actions={
        <Button size="sm" variant="secondary" onClick={markAllRead} disabled={unreadCount === 0}>
          {t.markAllRead}
        </Button>
      }
    >
      <div className="mb-3 flex gap-1">
        {(['all', 'unread'] as const).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={cn(
              'rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors',
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

      <div className="overflow-hidden rounded-[12px] border border-line bg-surface panel-shadow">
        <NotificationList items={visible} emptyMessage={t.empty[tab]} />
      </div>
    </PageShell>
  )
}
