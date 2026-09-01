import { Link, useParams } from 'react-router-dom'
import { STRINGS } from '../../../constants'
import { DetailList, DetailRow, DetailShell } from '../../../components/layout/DetailShell'
import { Panel } from '../../../components/layout/PageShell'
import { Badge, EmptyState } from '../../../components/ui'
import { useFleetData } from '../../fleet-data'
import { type Driver } from '../../../mocks/people'
import { hrefForDriverName } from '../../../lib/entityLinks'

const t = STRINGS.training

type LearnerStatus = keyof typeof t.detail.learnerStatus

const LEARNER_TONE: Record<LearnerStatus, 'success' | 'warning' | 'accent' | 'neutral'> = {
  completed: 'success',
  overdue: 'warning',
  in_progress: 'accent',
  not_started: 'neutral',
}

function learnersFor(
  drivers: Driver[],
  assigned: number,
  completed: number,
  overdue: number,
  assignTo: string,
) {
  if (assigned === 0 || assignTo === 'Nobody yet') return []
  const pool =
    assignTo === 'Pune depot' || assignTo === 'Nashik depot'
      ? drivers.filter((driver) => driver.terminal === assignTo)
      : drivers
  const target = pool.slice(0, Math.min(assigned, pool.length) || pool.length)
  const n = target.length
  if (n === 0) return []
  const completedCount = Math.min(n, Math.round((completed / Math.max(assigned, 1)) * n))
  const overdueCount = Math.min(n - completedCount, Math.round((overdue / Math.max(assigned, 1)) * n))
  return target.map((driver, index) => {
    let status: LearnerStatus = 'not_started'
    if (index < completedCount) status = 'completed'
    else if (index < completedCount + overdueCount) status = 'overdue'
    else status = completed === 0 && overdue === 0 ? 'not_started' : 'in_progress'
    return { driver: driver.name, status }
  })
}

export function CourseDetailPage() {
  const { courseId } = useParams()
  const { courses, drivers } = useFleetData()
  const course = courses.find((c) => c.id === courseId)

  if (!course) {
    return (
      <DetailShell backTo="/training" backLabel={t.back} title={t.notFound}>
        <Panel>
          <EmptyState title={t.notFound} />
        </Panel>
      </DetailShell>
    )
  }

  const learners = learnersFor(drivers, course.assigned, course.completed, course.overdue, course.assignTo)

  return (
    <DetailShell
      backTo="/training"
      backLabel={t.back}
      title={course.name}
      subtitle={t.minutes(course.lengthMinutes)}
      badge={
        <Badge tone={course.status === 'published' ? 'success' : 'neutral'}>
          {course.status === 'published' ? 'Published' : 'Draft'}
        </Badge>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <Panel title={t.detail.about}>
          <DetailList>
            <DetailRow label={t.detail.length}>{t.minutes(course.lengthMinutes)}</DetailRow>
            <DetailRow label={t.detail.assigned}>{course.assigned}</DetailRow>
            <DetailRow label={t.detail.completed}>{course.completed}</DetailRow>
            <DetailRow label={t.detail.overdue}>
              <span className={course.overdue > 0 ? 'font-semibold text-warn' : ''}>
                {course.overdue}
              </span>
            </DetailRow>
            <DetailRow label={t.detail.status}>
              <Badge tone={course.status === 'published' ? 'success' : 'neutral'}>
                {course.status === 'published' ? 'Published' : 'Draft'}
              </Badge>
            </DetailRow>
          </DetailList>
        </Panel>

        <Panel title={t.detail.learnersTitle} hint={t.detail.learnersHint}>
          {learners.length === 0 ? (
            <EmptyState title={STRINGS.empty.noneYetTitle} />
          ) : (
            <ul className="divide-y divide-line">
              {learners.map((row) => (
                <li key={row.driver} className="flex items-center gap-3 px-5 py-3">
                  <Link
                    to={hrefForDriverName(drivers, row.driver)}
                    className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink hover:text-accent"
                  >
                    {row.driver}
                  </Link>
                  <Badge tone={LEARNER_TONE[row.status]}>{t.detail.learnerStatus[row.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </DetailShell>
  )
}
