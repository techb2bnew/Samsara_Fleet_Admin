import { Link } from 'react-router-dom'
import { STRINGS } from '../../../constants'
import { PageShell, Panel } from '../../../components/layout/PageShell'
import { ArrowRightIcon, Button } from '../../../components/ui'

const t = STRINGS.help

export function HelpPage() {
  return (
    <PageShell title={t.title} description={t.description}>
      <div className="flex flex-col gap-5">
        <Panel title={t.contactTitle} hint={t.contactHint}>
          <dl className="divide-y divide-line">
            <div className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <dt className="text-[12.5px] text-ink-3">{t.emailLabel}</dt>
              <dd className="min-w-0 text-[13.5px] font-medium text-ink">
                <a href={`mailto:${t.email}`} className="hover:text-accent">
                  {t.email}
                </a>
              </dd>
            </div>
            <div className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <dt className="text-[12.5px] text-ink-3">{t.hoursLabel}</dt>
              <dd className="text-[13.5px] text-ink">{t.hours}</dd>
            </div>
            <div className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <dt className="text-[12.5px] text-ink-3">{t.replyLabel}</dt>
              <dd className="text-[13.5px] text-ink">{t.reply}</dd>
            </div>
          </dl>
          <div className="border-t border-line px-5 py-4">
            <Button size="sm" onClick={() => { window.location.href = `mailto:${t.email}` }}>
              {t.emailCta}
            </Button>
          </div>
        </Panel>

        <Panel title={t.guidesTitle} hint={t.guidesHint}>
          <ol className="divide-y divide-line">
            {t.guides.map((guide, index) => (
              <li key={guide.title} className="flex gap-3.5 px-5 py-4">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium text-ink">{guide.title}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-3">{guide.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title={t.topicsTitle} hint={t.topicsHint}>
          <ul className="grid gap-px bg-line sm:grid-cols-2">
            {t.topics.map((topic) => (
              <li key={topic.to} className="bg-surface">
                <Link
                  to={topic.to}
                  className="group flex items-start justify-between gap-3 px-5 py-4 transition-colors hover:bg-surface-2"
                >
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-medium text-ink group-hover:text-accent">
                      {topic.title}
                    </span>
                    <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-3">
                      {topic.body}
                    </span>
                  </span>
                  <ArrowRightIcon
                    size={14}
                    className="mt-1 shrink-0 text-ink-4 group-hover:text-accent"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </PageShell>
  )
}
