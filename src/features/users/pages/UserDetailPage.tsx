import { useParams } from 'react-router-dom'
import { STRINGS } from '../../../constants'
import { DetailList, DetailRow, DetailShell } from '../../../components/layout/DetailShell'
import { Panel } from '../../../components/layout/PageShell'
import { Badge, EmptyState } from '../../../components/ui'
import { useFleetData } from '../../fleet-data'
import { ROLE_SUMMARY, STAFF_STATUS_TONE } from '../../../mocks/people'

const t = STRINGS.users

export function UserDetailPage() {
  const { userId } = useParams()
  const { staff } = useFleetData()
  const user = staff.find((u) => u.id === userId)

  if (!user) {
    return (
      <DetailShell backTo="/users" backLabel={t.back} title={t.notFound}>
        <Panel>
          <EmptyState title={t.notFound} />
        </Panel>
      </DetailShell>
    )
  }

  const role = ROLE_SUMMARY.find((r) => r.name === user.role)

  return (
    <DetailShell
      backTo="/users"
      backLabel={t.back}
      title={user.name}
      subtitle={user.email}
      badge={<Badge tone={STAFF_STATUS_TONE[user.status]}>{t.tabs[user.status]}</Badge>}
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title={t.detail.profile}>
          <div className="flex items-center gap-3 border-b border-line px-5 py-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent">
              {user.initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-ink">{user.name}</p>
              <p className="truncate text-[12.5px] text-ink-3">{user.email}</p>
            </div>
          </div>
          <DetailList>
            <DetailRow label={t.detail.email}>{user.email}</DetailRow>
            <DetailRow label={t.detail.lastActive}>{user.lastActive}</DetailRow>
          </DetailList>
        </Panel>

        <Panel title={t.detail.access}>
          <DetailList>
            <DetailRow label={t.detail.role}>{user.role}</DetailRow>
            <DetailRow label={t.detail.fleet}>{user.fleet}</DetailRow>
            <DetailRow label={t.detail.status}>
              <Badge tone={STAFF_STATUS_TONE[user.status]}>{t.tabs[user.status]}</Badge>
            </DetailRow>
          </DetailList>
          {role && (
            <div className="border-t border-line px-5 py-4">
              <p className="text-[12px] font-medium text-ink-3">{t.detail.permissions}</p>
              <p className="mt-1 text-[13.5px] text-ink-2">{role.description}</p>
            </div>
          )}
        </Panel>
      </div>
    </DetailShell>
  )
}
