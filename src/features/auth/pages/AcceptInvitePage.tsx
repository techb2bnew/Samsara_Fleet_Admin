import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AuthLayout } from '../../../app/layouts/AuthLayout'
import { Alert, Button, Field } from '../../../components/ui'
import { PasswordStrength, passwordProblem } from '../components/PasswordStrength'
import { STRINGS } from '../../../constants'
import { useAuth } from '../AuthProvider'

const t = STRINGS.auth.acceptInvite

/**
 * Where a new member of staff lands from their invitation email. This is the
 * first screen they ever see, so it names the company that invited them and the
 * role they have been given — an invite with no context reads like phishing.
 */
export function AcceptInvitePage() {
  const [params] = useSearchParams()
  const { acceptInvite } = useAuth()

  /*
   * The invitation details come from the link. Reading them back from a token
   * needs a function that can look up the token's hash, which is not built
   * yet — so a link without them is refused rather than filled in with a
   * plausible organisation and role.
   *
   * Showing an invented company on the one screen where somebody is about to
   * type a password is exactly what phishing looks like.
   */
  const orgName = params.get('org')
  const roleName = params.get('role')
  const email = params.get('email')

  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ fullName?: string; password?: string }>({})
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    if (!fullName.trim()) next.fullName = t.errors.nameMissing
    const problem = passwordProblem(password)
    if (problem) next.password = problem

    setErrors(next)
    if (Object.keys(next).length > 0) return

    // The guard below returns before the form renders when these are missing,
    // so by the time this runs the email is known.
    if (!email) return

    setLoading(true)
    await acceptInvite(email, fullName.trim(), password)
    setLoading(false)
    // RedirectIfSignedIn routes to the console once the session exists.
  }

  if (!orgName || !roleName || !email) {
    return (
      <AuthLayout title={t.invalid.title} subtitle={t.invalid.subtitle}>
        <Alert tone="danger" title={t.invalid.noticeTitle}>
          {t.invalid.noticeBody}
        </Alert>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title={t.title(orgName)} subtitle={t.subtitle}>
      <Alert tone="accent" title={t.invitedAs(roleName)}>
        {t.signingInWith} <span className="font-medium text-ink">{email}</span>
      </Alert>

      <form onSubmit={handleSubmit} noValidate className="mt-4 flex flex-col gap-4">
        <Field
          label={t.nameLabel}
          autoComplete="name"
          placeholder={t.namePlaceholder}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={errors.fullName}
          disabled={loading}
          autoFocus
        />

        <div className="flex flex-col gap-2">
          <Field
            label={t.passwordLabel}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />
          <PasswordStrength value={password} />
        </div>

        <Button type="submit" size="lg" fullWidth loading={loading}>
          {t.submit}
        </Button>

        <p className="text-center text-[12.5px] leading-relaxed text-ink-3">{t.notExpecting}</p>
      </form>
    </AuthLayout>
  )
}
