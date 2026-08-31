import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../../../app/layouts/AuthLayout'
import { Alert, Button, Field } from '../../../components/ui'
import { PasswordStrength, passwordProblem } from '../components/PasswordStrength'
import { STRINGS } from '../../../constants'
import { useAuth } from '../AuthProvider'

const t = STRINGS.auth.resetPassword

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const { setPassword: savePassword } = useAuth()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({})
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    const problem = passwordProblem(password)
    if (problem) next.password = problem
    if (password !== confirm) next.confirm = t.errors.mismatch

    setErrors(next)
    if (Object.keys(next).length > 0) return

    setLoading(true)
    await savePassword(password)
    setLoading(false)
    setDone(true)
  }

  if (done) {
    return (
      <AuthLayout title={t.done.title} subtitle={t.done.subtitle}>
        <Alert tone="success">{t.done.subtitle}</Alert>
        <Button size="lg" fullWidth className="mt-4" onClick={() => navigate('/login')}>
          {t.done.cta}
        </Button>
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
        <div className="flex flex-col gap-2">
          <Field
            label={t.passwordLabel}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            disabled={loading}
            autoFocus
          />
          <PasswordStrength value={password} />
        </div>

        <Field
          label={t.confirmLabel}
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={errors.confirm}
          disabled={loading}
        />

        <Button type="submit" size="lg" fullWidth loading={loading}>
          {t.submit}
        </Button>
      </form>
    </AuthLayout>
  )
}
