import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../../../app/layouts/AuthLayout'
import { Alert, Button, Field } from '../../../components/ui'
import { STRINGS } from '../../../constants'
import { useAuth } from '../AuthProvider'
import { MIN_LOGIN_PASSWORD_LENGTH } from '../../../mocks/auth'

const t = STRINGS.auth.login

type Errors = { email?: string; password?: string; form?: string }

export function LoginPage() {
  const { signIn } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [errors, setErrors] = useState<Errors>({})
  const [loading, setLoading] = useState(false)

  function validate(): Errors {
    const next: Errors = {}
    if (!email.trim()) next.email = t.errors.emailMissing
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = t.errors.emailInvalid

    if (!password) next.password = t.errors.passwordMissing
    else if (password.length < MIN_LOGIN_PASSWORD_LENGTH) {
      next.password = t.errors.passwordTooShort(MIN_LOGIN_PASSWORD_LENGTH)
    }
    return next
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    const next = validate()
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setLoading(true)
    const result = await signIn(email.trim(), password, remember)
    setLoading(false)

    if (!result.ok) {
      setErrors({ form: result.error })
    }
    // On success RedirectIfSignedIn takes over and routes to wherever the user
    // was originally headed. Navigating here as well would race that guard.
  }

  return (
    <AuthLayout
      title={t.title}
      subtitle={t.subtitle}
      footer={
        <>
          {t.supportPrefix}{' '}
          <a className="text-accent-on-brand hover:underline" href="mailto:support@example.com">
            {t.supportLink}
          </a>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {errors.form && <Alert tone="danger">{errors.form}</Alert>}

        <Field
          label={t.emailLabel}
          type="email"
          name="email"
          autoComplete="email"
          placeholder={t.emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          disabled={loading}
          autoFocus
        />

        {/* The reset link sits under the field rather than beside its label, so
            the label row stays a plain label and the link reads as the next
            thing to try after typing a password that did not work. */}
        <div className="flex flex-col gap-2">
          <Field
            label={t.passwordLabel}
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder={t.passwordPlaceholder}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            disabled={loading}
          />
          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-[13px] text-accent hover:underline">
              {t.forgotLink}
            </Link>
          </div>
        </div>

        <label className="flex items-center gap-2 text-[13px] text-ink-2 select-none">
          <input
            type="checkbox"
            className="size-3.5 rounded-[3px] border-line-strong accent-accent"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            disabled={loading}
          />
          {t.keepSignedIn}
        </label>

        <Button type="submit" size="lg" fullWidth loading={loading}>
          {t.submit}
        </Button>
      </form>
    </AuthLayout>
  )
}
