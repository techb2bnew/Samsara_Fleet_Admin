import { Link } from 'react-router-dom'
import { Logo } from '../../../components/layout/Logo'
import { STRINGS } from '../../../constants'
import type { LegalDocument } from '../documents'

const t = STRINGS.legal

/**
 * A public document: the privacy policy, the terms, or the support page.
 *
 * ---------------------------------------------------------------------------
 * Public means public
 * ---------------------------------------------------------------------------
 * These are reachable with no account, and that is the whole point of them.
 * App Store review opens the privacy policy URL in a browser with no login; so
 * does anybody deciding whether to trust the app. A policy behind a sign-in is
 * the same as no policy, and it fails review.
 *
 * So they sit outside BOTH route guards — not only outside RequireAuth, but
 * outside RedirectIfSignedIn as well, which would have bounced a signed-in
 * fleet admin to the dashboard for clicking a link to the terms.
 *
 * ---------------------------------------------------------------------------
 * Shape
 * ---------------------------------------------------------------------------
 * One column, wide enough for about seventy characters. A legal document is
 * read in long lines of prose rather than scanned in panels, and the console's
 * own layout — a rail, a header, a grid of cards — is furniture that has
 * nothing to do with reading one.
 */
export function LegalPage({ document }: { document: LegalDocument }) {
  return (
    <div className="min-h-dvh bg-ground">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[46rem] items-center justify-between gap-4 px-5 py-4">
          <Logo />
          {/* Back to the console, for the reader who arrived from inside it.
              A plain link, because a signed-out reader lands on sign-in and
              that is the right place for them. */}
          <Link to="/" className="text-[13px] text-ink-3 hover:text-accent">
            {t.backToConsole}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[46rem] px-5 py-10">
        <h1 className="text-[26px] font-semibold tracking-tight text-ink">{document.title}</h1>
        <p className="mt-1.5 text-[13px] text-ink-3">{t.updated(document.updated)}</p>

        <p className="mt-6 text-[15px] leading-7 text-ink-2">{document.intro}</p>

        {document.sections.map((section) => (
          <section key={section.heading} className="mt-9">
            <h2 className="text-[17px] font-semibold text-ink">{section.heading}</h2>
            {section.body.map((paragraph, i) =>
              /*
               * A line beginning "- " is a bullet. Cheaper than a second field
               * on every section, and it keeps the document readable as source
               * — which matters when the person editing it is a lawyer rather
               * than whoever wrote this component.
               */
              paragraph.startsWith('- ') ? (
                <ul key={i} className="mt-2 list-disc pl-5">
                  <li className="text-[15px] leading-7 text-ink-2">{paragraph.slice(2)}</li>
                </ul>
              ) : (
                <p key={i} className="mt-3 text-[15px] leading-7 text-ink-2">
                  {paragraph}
                </p>
              ),
            )}
          </section>
        ))}

        <nav className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-6 text-[13.5px]">
          <Link to="/privacy" className="text-ink-3 hover:text-accent">
            {t.privacy}
          </Link>
          <Link to="/terms" className="text-ink-3 hover:text-accent">
            {t.terms}
          </Link>
          <Link to="/support" className="text-ink-3 hover:text-accent">
            {t.support}
          </Link>
        </nav>
      </main>
    </div>
  )
}
