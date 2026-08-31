import { STRINGS } from '../../../constants'
import { PageShell, Panel } from '../../../components/layout/PageShell'
import { Badge, Button, DataTable, EmptyState, type Column } from '../../../components/ui'
import { type Course } from '../../../mocks/admin'
import { useFleetData } from '../../fleet-data'
import { useOpenOnQuery } from '../../../lib/useOpenOnQuery'
import { NewCourseDialog } from '../components/NewCourseDialog'

const t = STRINGS.training

/** Module A12. */
export function TrainingPage() {
  const { courses } = useFleetData()
  const [creating, setCreating] = useOpenOnQuery()

  const columns: Column<Course>[] = [
    {
      key: 'course',
      header: t.columns.course,
      render: (c) => <span className="font-medium text-ink">{c.name}</span>,
    },
    {
      key: 'length',
      header: t.columns.length,
      width: '100px',
      render: (c) => <span className="text-ink-3">{t.minutes(c.lengthMinutes)}</span>,
    },
    { key: 'assigned', header: t.columns.assigned, align: 'right', width: '100px', render: (c) => c.assigned },
    {
      key: 'completed',
      header: t.columns.completed,
      align: 'right',
      width: '160px',
      render: (c) =>
        c.assigned === 0 ? (
          <span className="text-ink-4">—</span>
        ) : (
          <div className="flex items-center justify-end gap-2.5">
            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
              <span
                className="block h-full rounded-full bg-ok"
                style={{ width: `${(c.completed / c.assigned) * 100}%` }}
              />
            </span>
            <span className="font-mono text-[12px] text-ink-2">
              {c.completed}/{c.assigned}
            </span>
          </div>
        ),
    },
    {
      key: 'overdue',
      header: t.columns.overdue,
      align: 'right',
      width: '100px',
      render: (c) =>
        c.overdue > 0 ? (
          <span className="font-semibold text-warn">{c.overdue}</span>
        ) : (
          <span className="text-ink-4">—</span>
        ),
    },
    {
      key: 'status',
      header: t.columns.status,
      width: '120px',
      render: (c) => (
        <Badge tone={c.status === 'published' ? 'success' : 'neutral'}>
          {c.status === 'published' ? 'Published' : 'Draft'}
        </Badge>
      ),
    },
  ]

  return (
    <PageShell
      eyebrow="Module A12"
      title={t.title}
      description={t.description}
      actions={<Button size="sm" onClick={() => setCreating(true)}>{t.newCourse}</Button>}
    >
      <Panel>
        <DataTable columns={columns} rows={courses} getRowKey={(c) => c.id} empty={
            <EmptyState title={STRINGS.empty.noneYetTitle} hint="Courses you create will appear here." />
          } />
      </Panel>

      <NewCourseDialog open={creating} onClose={() => setCreating(false)} />
    </PageShell>
  )
}
