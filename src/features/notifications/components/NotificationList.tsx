import { Link } from 'react-router-dom'
import { STRINGS, TONE_SOLID } from '../../../constants'
import { cn } from '../../../lib/cn'
import type { Notification } from '../types'
import { useNotifications } from '../NotificationsProvider'

const t = STRINGS.notifications

/**
 * Shared list rendering for the header panel and the full page.
 *
 * Opening a notification marks it read — that is what a person means by
 * "I've seen it", and making them click a separate control for it is busywork.
 * The explicit control stays for the case where they want to clear something
 * without opening it.
 */
export function NotificationList({
  items,
  emptyMessage,
  onNavigate,
  dense = false,
}: {
  items: Notification[]
  emptyMessage: string
  onNavigate?: () => void
  dense?: boolean
}) {
  const { markRead } = useNotifications()

  if (items.length === 0) {
    return (
      <p className="px-5 py-12 text-center text-[13px] leading-relaxed text-ink-3">
        {emptyMessage}
      </p>
    )
  }

  return (
    <ul>
      {items.map((item) => (
        <li key={item.id} className="group relative border-b border-line last:border-b-0">
          <Link
            to={item.href}
            onClick={() => {
              markRead(item.id)
              onNavigate?.()
            }}
            className={cn(
              'flex items-start gap-3 pr-3 transition-colors hover:bg-surface-2',
              dense ? 'py-3 pl-4' : 'py-3.5 pl-5',
              !item.read && 'bg-accent-soft/40',
            )}
          >
            <span
              className={cn(
                'mt-1.5 size-2 shrink-0 rounded-full',
                item.read ? 'bg-ink-4/40' : TONE_SOLID[item.tone],
              )}
              aria-hidden="true"
            />

            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  'block text-[13.5px] leading-snug',
                  item.read ? 'font-medium text-ink-2' : 'font-semibold text-ink',
                )}
              >
                {item.title}
              </span>
              <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-3">
                {item.detail}
              </span>
              <span className="mt-1 block text-[11.5px] text-ink-4">{item.at}</span>
            </span>

            {!item.read && (
              <span className="sr-only">{t.unreadCount(1)}</span>
            )}
          </Link>

          {/* Sits above the link rather than inside it, because a button nested
              in an anchor is invalid and swallows the click on some browsers. */}
          {!item.read && (
            <button
              onClick={() => markRead(item.id)}
              title={t.markRead}
              aria-label={`${t.markRead}: ${item.title}`}
              className="absolute top-3 right-3 rounded-[5px] px-1.5 py-0.5 text-[11px] font-medium text-ink-4 opacity-0 transition hover:bg-surface hover:text-accent group-focus-within:opacity-100 group-hover:opacity-100"
            >
              {t.markRead}
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
