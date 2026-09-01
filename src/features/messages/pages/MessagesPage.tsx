import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { STRINGS } from '../../../constants'
import { cn } from '../../../lib/cn'
import { PageShell, Panel } from '../../../components/layout/PageShell'
import { ArrowRightIcon, Button, EmptyState, useToast } from '../../../components/ui'
import { useOpenOnQuery } from '../../../lib/useOpenOnQuery'
import { MOCK_MESSAGES, MOCK_THREADS, type Message, type Thread } from '../../../mocks/operations'
import { BroadcastDialog } from '../components/BroadcastDialog'

const t = STRINGS.messages

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (parts[0]?.slice(0, 2) ?? '??').toUpperCase()
}

/** Module A10. Inbox on the left, conversation on the right. */
export function MessagesPage() {
  const { show } = useToast()
  const [params, setParams] = useSearchParams()
  const [broadcasting, setBroadcasting] = useOpenOnQuery()

  const [threads, setThreads] = useState<Thread[]>(MOCK_THREADS)
  const [conversations, setConversations] = useState<Record<string, Message[]>>(MOCK_MESSAGES)
  const [selectedId, setSelectedId] = useState<string>(MOCK_THREADS[0]?.id ?? '')
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [showThread, setShowThread] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const nextMessageId = useRef(1)
  const nextThreadId = useRef(1)
  const threadsRef = useRef(threads)
  const conversationsRef = useRef(conversations)
  threadsRef.current = threads
  conversationsRef.current = conversations

  const selected = threads.find((thread) => thread.id === selectedId) ?? threads[0]
  const messages = selected ? (conversations[selected.id] ?? []) : []

  const visibleThreads = threads.filter((thread) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return thread.driver.toLowerCase().includes(q) || thread.preview.toLowerCase().includes(q)
  })

  function applyMessages(driverNames: string[], body: string) {
    const at = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    let nextThreads = threadsRef.current
    let nextConversations = { ...conversationsRef.current }
    const created: string[] = []

    for (const name of driverNames) {
      let thread = nextThreads.find((item) => item.driver === name)
      if (!thread) {
        thread = {
          id: `t-new-${nextThreadId.current++}`,
          driver: name,
          initials: initialsOf(name),
          preview: body,
          at,
          unread: false,
        }
        nextThreads = [thread, ...nextThreads]
      } else {
        nextThreads = nextThreads.map((item) =>
          item.id === thread!.id ? { ...item, preview: body, at, unread: false } : item,
        )
      }
      created.push(thread.id)
      const message: Message = { id: `sent-${nextMessageId.current++}`, from: 'office', body, at }
      nextConversations[thread.id] = [...(nextConversations[thread.id] ?? []), message]
    }

    threadsRef.current = nextThreads
    conversationsRef.current = nextConversations
    setThreads(nextThreads)
    setConversations(nextConversations)
    return created[0]
  }

  useEffect(() => {
    const name = params.get('driver')
    if (!name) return

    const existing = threadsRef.current.find((thread) => thread.driver === name)
    if (existing) {
      setSelectedId(existing.id)
    } else {
      const id = `t-new-${nextThreadId.current++}`
      const thread: Thread = {
        id,
        driver: name,
        initials: initialsOf(name),
        preview: t.newThreadPreview,
        at: 'Now',
        unread: false,
      }
      const nextThreads = [thread, ...threadsRef.current]
      const nextConversations = { ...conversationsRef.current, [id]: conversationsRef.current[id] ?? [] }
      threadsRef.current = nextThreads
      conversationsRef.current = nextConversations
      setThreads(nextThreads)
      setConversations(nextConversations)
      setSelectedId(id)
    }
    setShowThread(true)
    const next = new URLSearchParams(params)
    next.delete('driver')
    setParams(next, { replace: true })
  }, [params, setParams])

  // Keep the newest message in view, both on send and when switching threads.
  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages.length, selectedId])

  /** Opening a thread marks it read — that is what "I have seen it" means. */
  function openThread(thread: Thread) {
    setSelectedId(thread.id)
    setShowThread(true)
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
          <div className={cn('min-w-0 flex-col', showThread ? 'flex' : 'hidden md:flex')}>
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

            <form onSubmit={sendMessage} className="flex items-center gap-2 border-t border-line bg-ground/50 px-4 py-3">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t.composePlaceholder}
                aria-label={t.composePlaceholder}
                className="h-10 flex-1 rounded-[9px] border border-line bg-surface px-3.5 text-[13.5px] text-ink placeholder:text-ink-4 focus:border-accent"
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

      <BroadcastDialog
        open={broadcasting}
        onClose={() => setBroadcasting(false)}
        onSend={(body, recipients) => {
          const first = applyMessages(recipients, body)
          if (first) {
            setSelectedId(first)
            setShowThread(true)
          }
        }}
      />
    </PageShell>
  )
}
