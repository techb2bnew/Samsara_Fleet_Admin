import { useMemo, useState } from 'react'
import { STRINGS } from '../../../constants'
import { PageShell, Panel } from '../../../components/layout/PageShell'
import { Badge, Button, DataTable, EmptyState, FilterChips, Toolbar, type Column } from '../../../components/ui'
import { ROLE_SUMMARY, STAFF_STATUS_TONE, type StaffUser } from '../../../mocks/people'
import { useFleetData } from '../../fleet-data'
import { useOpenOnQuery } from '../../../lib/useOpenOnQuery'
import { InviteUserDialog } from '../components/InviteUserDialog'

const t = STRINGS.users
type Tab = keyof typeof t.tabs

/** Module A01. */
export function UsersPage() {
  const { staff } = useFleetData()
  const [inviting, setInviting] = useOpenOnQuery()
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return staff.filter((u) => {
      if (tab !== 'all' && u.status !== tab) return false
      if (!q) return true
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    })
  }, [staff, tab, search])

  const columns: Column<StaffUser>[] = [
    {
      key: 'user',
      header: t.columns.user,
      render: (u) => (
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[10.5px] font-semibold text-ink-2">
            {u.initials}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium whitespace-nowrap text-ink">{u.name}</p>
            <p className="truncate text-[12px] text-ink-3">{u.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'role', header: t.columns.role, render: (u) => u.role },
    { key: 'fleet', header: t.columns.fleet, secondary: true, render: (u) => u.fleet },
    {
      key: 'status',
      header: t.columns.status,
      width: '140px',
      render: (u) => <Badge tone={STAFF_STATUS_TONE[u.status]}>{t.tabs[u.status]}</Badge>,
    },
    {
      key: 'lastActive',
      header: t.columns.lastActive,
      secondary: true,
      render: (u) => <span className="text-ink-3">{u.lastActive}</span>,
    },
  ]

  const countFor = (key: Tab) =>
    key === 'all' ? staff.length : staff.filter((u) => u.status === key).length

  return (
    <PageShell
      eyebrow="Module A01"
      title={t.title}
      description={t.description}
      actions={<Button size="sm" onClick={() => setInviting(true)}>{t.invite}</Button>}
    >
      <div className="grid gap-5 2xl:grid-cols-[1fr_320px]">
        <Panel>
          <Toolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={t.searchPlaceholder}
          >
            <FilterChips
              value={tab}
              onChange={setTab}
              options={(Object.keys(t.tabs) as Tab[]).map((key) => ({
                value: key,
                label: t.tabs[key],
                count: countFor(key),
              }))}
            />
          </Toolbar>
          <DataTable columns={columns} rows={rows} getRowKey={(u) => u.id} empty={
            <EmptyState
              title={
                staff.length === 0
                  ? STRINGS.empty.noneYetTitle
                  : STRINGS.empty.noMatchTitle
              }
              hint={
                staff.length === 0
                  ? 'Invited staff will appear here once you add them.'
                  : STRINGS.empty.noMatchHint
              }
              onClear={
                staff.length === 0 ? undefined : () => { setTab('all'); setSearch('') }
              }
              clearLabel={STRINGS.empty.clearFilters}
            />
          } />
        </Panel>

        <Panel title={t.rolesTitle} hint={t.rolesHint}>
          <ul className="divide-y divide-line">
            {ROLE_SUMMARY.map((role) => (
              <li key={role.key} className="px-5 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[13.5px] font-medium text-ink">{role.name}</p>
                  <span className="shrink-0 text-[12px] text-ink-4">
                    {t.peopleCount(role.people)}
                  </span>
                </div>
                <p className="mt-0.5 text-[12.5px] text-ink-3">{role.description}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <InviteUserDialog open={inviting} onClose={() => setInviting(false)} />
    </PageShell>
  )
}
