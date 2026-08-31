import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../../../app/layouts/AuthLayout'
import { Alert, Button, Field } from '../../../components/ui'
import { STRINGS } from '../../../constants'
import { useAuth } from '../AuthProvider'

const t = STRINGS.auth.forgotPassword

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string>()
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(t.errors.emailInvalid)
      return
    }
    setError(undefined)
    setLoading(true)
    await requestPasswordReset(email.trim())
    setLoading(false)
    setSent(true)
  }

  if (sent) {
    return (
      <AuthLayout
        title={t.sent.title}
        subtitle={t.sent.subtitle(email)}
        footer={
          <Link to="/login" className="text-accent-on-brand hover:underline">
            {t.backToSignIn}
          </Link>
        }
      >
        <Alert tone="accent" title={t.sent.noticeTitle}>
          {t.sent.noticeBody}
        </Alert>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={t.title}
      subtitle={t.subtitle}
      footer={
        <Link to="/login" className="text-accent-on-brand hover:underline">
          {t.backToSignIn}
        </Link>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Field
          label={t.emailLabel}
          type="email"
          autoComplete="email"
          placeholder={t.emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error}
          disabled={loading}
          autoFocus
        />
        <Button type="submit" size="lg" fullWidth loading={loading}>
          {t.submit}
        </Button>
      </form>
    </AuthLayout>
  )
}
