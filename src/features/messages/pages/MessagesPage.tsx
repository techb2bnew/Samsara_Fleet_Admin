import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { STRINGS } from '../../../constants'
import { cn } from '../../../lib/cn'
import { PageShell, Panel } from '../../../components/layout/PageShell'
import { Alert, ArrowRightIcon, Button, EmptyState, useToast } from '../../../components/ui'
import { useOpenOnQuery } from '../../../lib/useOpenOnQuery'
import { type Thread } from '../types'
import { BroadcastDialog } from '../components/BroadcastDialog'
import { useFleetData } from '../../fleet-data'

const t = STRINGS.messages


/** Module A10. Inbox on the left, conversation on the right. */
export function MessagesPage() {
  const { show } = useToast()
  const [params, setParams] = useSearchParams()
  const [broadcasting, setBroadcasting] = useOpenOnQuery()

  const {
    threads,
    messagesByThread,
    drivers,
    sendToDriver,
    broadcast,
    markThreadRead,
    opsStatus,
    opsError,
    reloadOps,
  } = useFleetData()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showThread, setShowThread] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)

  /**
   * A conversation is a driver — see the messaging migration — so a driver with
   * no messages yet is a thread with an empty list rather than something that
   * has to be created first.
   */
  const inbox = useMemo<Thread[]>(() => {
    const known = new Set(threads.map((thread) => thread.id))
    const rest = drivers
      .filter((driver) => !known.has(driver.id))
      .map<Thread>((driver) => ({
        id: driver.id,
        driver: driver.name,
        initials: driver.initials,
        preview: t.newThreadPreview,
        at: '',
        unreadCount: 0,
      }))
    return [...threads, ...rest]
  }, [threads, drivers])

  const selected = inbox.find((thread) => thread.id === selectedId) ?? inbox[0] ?? null
  const messages = selected ? (messagesByThread[selected.id] ?? []) : []

  const visibleThreads = inbox.filter((thread) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return thread.driver.toLowerCase().includes(q) || thread.preview.toLowerCase().includes(q)
  })

  // Arriving from a link like /messages?driver=Dev%20Singh.
  useEffect(() => {
    const name = params.get('driver')
    if (!name || inbox.length === 0) return

    const match = inbox.find((thread) => thread.driver === name)
    if (match) {
      setSelectedId(match.id)
      setShowThread(true)
    }
    const next = new URLSearchParams(params)
    next.delete('driver')
    setParams(next, { replace: true })
  }, [params, setParams, inbox])

  // Keep the newest message in view, both on send and when switching threads.
  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages.length, selectedId])

  /** Opening a thread marks it read — that is what "I have seen it" means. */
  function openThread(thread: Thread) {
    setSelectedId(thread.id)
    setShowThread(true)
    if (thread.unreadCount > 0) markThreadRead(thread.id)
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault()
    const body = draft.trim()
    if (!body || !selected) return

    setSending(true)
    setSendError(null)
    try {
      await sendToDriver(selected.id, body)
    } catch (error) {
      setSendError(error instanceof Error ? error.message : t.sendFailed)
      return
    } finally {
      setSending(false)
    }

    setDraft('')
    show(t.sentToast(selected.driver))
  }

  return (
    <PageShell
      eyebrow="Module A10"
      title={t.title}
      description={t.description}
      actions={
        <Button size="sm" onClick={() => setBroadcasting(true)}>
          {t.broadcast}
        </Button>
      }
    >
      {opsStatus === 'error' && (
        <div className="mb-5" role="alert">
          <Alert tone="danger" title={t.loadFailed}>
            <div className="flex flex-wrap items-center gap-3">
              <span>{opsError}</span>
              <Button size="sm" variant="secondary" onClick={reloadOps}>
                {STRINGS.common.retry}
              </Button>
            </div>
          </Alert>
        </div>
      )}

      <Panel className="grid h-[min(560px,calc(100dvh-12rem))] grid-cols-1 md:grid-cols-[300px_1fr]">
        {/* inbox */}
        <div
          className={cn(
            'min-h-0 flex-col border-line md:border-r',
            showThread ? 'hidden md:flex' : 'flex',
          )}
        >
          <div className="border-b border-line p-2.5">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.searchPlaceholder}
              aria-label={t.searchPlaceholder}
              className="h-9 w-full rounded-[8px] border border-line bg-ground px-3 text-[13px] text-ink placeholder:text-ink-4 focus:border-accent focus:bg-surface"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {visibleThreads.length === 0 ? (
              <EmptyState title={STRINGS.empty.noMatchTitle} hint={STRINGS.empty.noMatchHint} />
            ) : (
              <ul className="divide-y divide-line">
                {visibleThreads.map((thread) => (
                  <li key={thread.id}>
                    <button
                      onClick={() => openThread(thread)}
                      className={cn(
                        'flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors',
                        selected?.id === thread.id ? 'bg-accent-soft' : 'hover:bg-surface-2',
                      )}
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[10.5px] font-semibold text-accent">
                        {thread.initials}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span
                            className={cn(
                              'truncate text-[13px]',
                              thread.unreadCount > 0
                                ? 'font-semibold text-ink'
                                : 'font-medium text-ink-2',
                            )}
                          >
                            {thread.driver}
                          </span>
                          <span className="shrink-0 text-[11px] text-ink-4">{thread.at}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-[12.5px] text-ink-3">
                          {thread.preview}
                        </span>
                      </span>
                      {/* A count, not a dot. How many are waiting is the
                          thing a dispatcher is deciding between threads on. */}
                      {thread.unreadCount > 0 && (
                        <span
                          className="mt-1 flex min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-on-accent"
                          aria-label={t.unreadCount(thread.unreadCount)}
                        >
                          {thread.unreadCount > 99 ? '99+' : thread.unreadCount}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* conversation */}
        {selected ? (
          /*
           * min-h-0 is load-bearing. A grid item's min-height defaults to
           * auto, so without it this column grows to fit every message — the
           * inner overflow-y-auto never gets a bounded height, and the
           * composer is pushed past the panel's overflow-hidden and vanishes.
           */
          <div
            className={cn(
              'min-h-0 min-w-0 flex-col',
              showThread ? 'flex' : 'hidden md:flex',
            )}
          >
            <div className="flex items-center gap-2.5 border-b border-line px-4 py-3 sm:px-5">
              <button
                type="button"
                onClick={() => setShowThread(false)}
                className="flex size-8 items-center justify-center rounded-[8px] text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink md:hidden"
                aria-label={t.backToInbox}
              >
                <ArrowRightIcon size={16} className="rotate-180" />
              </button>
              <span className="flex size-8 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">
                {selected.initials}
              </span>
              <p className="text-[14px] font-semibold tracking-[-0.01em] text-ink">{selected.driver}</p>
            </div>

            <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {messages.length === 0 ? (
                <p className="py-12 text-center text-[13px] text-ink-3">{t.newThreadPreview}</p>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex',
                      message.from === 'office' ? 'justify-end' : 'justify-start',
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[75%] rounded-[10px] px-3.5 py-2.5',
                        message.from === 'office'
                          ? 'bg-accent text-on-accent'
                          : 'bg-surface-2 text-ink',
                      )}
                    >
                      <p className="text-[13.5px] leading-relaxed">{message.body}</p>
                      <p
                        className={cn(
                          'mt-1 text-[11px]',
                          message.from === 'office' ? 'text-on-accent/70' : 'text-ink-4',
                        )}
                      >
                        {message.at}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={sendMessage} className="border-t border-line bg-ground/50 px-4 py-3">
              {sendError && (
                <p className="mb-2 text-[12.5px] text-danger" role="alert">
                  {sendError}
                </p>
              )}
              <div className="flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t.composePlaceholder}
                aria-label={t.composePlaceholder}
                className="h-10 flex-1 rounded-[9px] border border-line bg-surface px-3.5 text-[13.5px] text-ink placeholder:text-ink-4 focus:border-accent"
              />
              <Button size="sm" type="submit" loading={sending} disabled={!draft.trim()}>
                {t.send}
              </Button>
              </div>
            </form>
          </div>
        ) : (
          <EmptyState title={t.empty} />
        )}
      </Panel>

      <BroadcastDialog
        open={broadcasting}
        onClose={() => setBroadcasting(false)}
        onSend={async (body) => {
          // Every driver gets their own copy, so each has its own read
          // receipt — see broadcastMessage in supabase/api.
          await broadcast(body)
        }}
      />
    </PageShell>
  )
}
