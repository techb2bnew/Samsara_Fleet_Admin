import { useEffect, useRef, useState, type FormEvent } from 'react'
import { STRINGS } from '../../../constants'
import { cn } from '../../../lib/cn'
import { PageShell, Panel } from '../../../components/layout/PageShell'
import { Button, EmptyState, useToast } from '../../../components/ui'
import { useOpenOnQuery } from '../../../lib/useOpenOnQuery'
import { MOCK_MESSAGES, MOCK_THREADS, type Message, type Thread } from '../../../mocks/operations'
import { BroadcastDialog } from '../components/BroadcastDialog'

const t = STRINGS.messages

/** Module A10. Inbox on the left, conversation on the right. */
export function MessagesPage() {
  const { show } = useToast()
  const [broadcasting, setBroadcasting] = useOpenOnQuery()

  const [threads, setThreads] = useState<Thread[]>(MOCK_THREADS)
  const [conversations, setConversations] = useState<Record<string, Message[]>>(MOCK_MESSAGES)
  const [selectedId, setSelectedId] = useState<string>(MOCK_THREADS[0]?.id ?? '')
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')

  const scrollRef = useRef<HTMLDivElement>(null)
  const nextMessageId = useRef(1)

  const selected = threads.find((thread) => thread.id === selectedId) ?? threads[0]
  const messages = selected ? (conversations[selected.id] ?? []) : []

  const visibleThreads = threads.filter((thread) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return thread.driver.toLowerCase().includes(q) || thread.preview.toLowerCase().includes(q)
  })

  // Keep the newest message in view, both on send and when switching threads.
  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages.length, selectedId])

  /** Opening a thread marks it read — that is what "I have seen it" means. */
  function openThread(thread: Thread) {
    setSelectedId(thread.id)
    setThreads((current) =>
      current.map((item) => (item.id === thread.id ? { ...item, unread: false } : item)),
    )
  }

  function sendMessage(event: FormEvent) {
    event.preventDefault()
    const body = draft.trim()
    if (!body || !selected) return

    const at = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const message: Message = { id: `sent-${nextMessageId.current++}`, from: 'office', body, at }

    setConversations((current) => ({
      ...current,
      [selected.id]: [...(current[selected.id] ?? []), message],
    }))
    setThreads((current) =>
      current.map((thread) =>
        thread.id === selected.id ? { ...thread, preview: body, at, unread: false } : thread,
      ),
    )
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
      <Panel className="grid h-[560px] grid-cols-1 md:grid-cols-[300px_1fr]">
        {/* inbox */}
        <div className="flex min-h-0 flex-col border-line md:border-r">
          <div className="border-b border-line p-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.searchPlaceholder}
              aria-label={t.searchPlaceholder}
              className="h-8.5 w-full rounded-[6px] border border-line bg-ground px-3 text-[13px] text-ink placeholder:text-ink-4 focus:border-accent focus:bg-surface"
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
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[10.5px] font-semibold text-ink-2">
                        {thread.initials}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span
                            className={cn(
                              'truncate text-[13px]',
                              thread.unread ? 'font-semibold text-ink' : 'font-medium text-ink-2',
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
                      {thread.unread && (
                        <span
                          className="mt-1.5 size-2 shrink-0 rounded-full bg-accent"
                          aria-hidden="true"
                        />
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
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-2.5 border-b border-line px-5 py-3">
              <span className="flex size-7 items-center justify-center rounded-full bg-surface-2 text-[10.5px] font-semibold text-ink-2">
                {selected.initials}
              </span>
              <p className="text-[14px] font-semibold text-ink">{selected.driver}</p>
            </div>

            <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {messages.length === 0 ? (
                <p className="py-12 text-center text-[13px] text-ink-3">{t.selectThread}</p>
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

            <form onSubmit={sendMessage} className="flex items-center gap-2 border-t border-line px-4 py-3">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t.composePlaceholder}
                aria-label={t.composePlaceholder}
                className="h-9 flex-1 rounded-[7px] border border-line bg-ground px-3 text-[13.5px] text-ink placeholder:text-ink-4 focus:border-accent focus:bg-surface"
              />
              <Button size="sm" type="submit" disabled={!draft.trim()}>
                {t.send}
              </Button>
            </form>
          </div>
        ) : (
          <EmptyState title={t.empty} />
        )}
      </Panel>

      <BroadcastDialog open={broadcasting} onClose={() => setBroadcasting(false)} />
    </PageShell>
  )
}
