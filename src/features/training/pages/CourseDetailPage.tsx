import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { STRINGS } from '../../../constants'
import { DetailList, DetailRow, DetailShell } from '../../../components/layout/DetailShell'
import { Panel } from '../../../components/layout/PageShell'
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Field,
  FileField,
  Textarea,
  useToast,
} from '../../../components/ui'
import * as api from '../../../supabase/api'
import { useFleetData } from '../../fleet-data'
import { hrefForDriverName } from '../../../lib/entityLinks'
import { AssignCourseDialog } from '../components/AssignCourseDialog'
import type { Learner } from '../types'

const t = STRINGS.training

const LEARNER_TONE: Record<Learner['status'], 'success' | 'warning' | 'accent' | 'neutral'> = {
  completed: 'success',
  overdue: 'warning',
  in_progress: 'accent',
  assigned: 'neutral',
}

/** "12 Aug 2026", or nothing when no deadline was set. */
function formatDue(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function CourseDetailPage() {
  const { courseId } = useParams()
  const {
    courses,
    drivers,
    unassignCourse,
    setCoursePublished,
    setCourseContent,
    saveCourseDetails,
  } = useFleetData()
  const { show } = useToast()
  const [assigning, setAssigning] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pickerKey, setPickerKey] = useState(0)
  const [savingDetails, setSavingDetails] = useState(false)
  const [draft, setDraft] = useState({ description: '', lengthMinutes: '' })


  const course = courses.find((c) => c.id === courseId)

  /*
    The editable copy is seeded from the course once it has loaded, and again
    when its values change under us — the provider reloads the whole list after
    any write, so the object identity changes even when the fields do not.
    Keyed on the values rather than the object, so a reload triggered by some
    other write does not wipe what is being typed here.

    Above the early return because hooks cannot run after one.
  */
  const loadedDescription = course?.description ?? ''
  const loadedLength =
    course?.lengthMinutes === null || course?.lengthMinutes === undefined
      ? ''
      : String(course.lengthMinutes)
  useEffect(() => {
    setDraft({ description: loadedDescription, lengthMinutes: loadedLength })
  }, [loadedDescription, loadedLength])

  if (!course) {
    return (
      <DetailShell backTo="/training" backLabel={t.back} title={t.notFound}>
        <Panel>
          <EmptyState title={t.notFound} />
        </Panel>
      </DetailShell>
    )
  }

  const published = course?.status === 'published'

  async function togglePublished() {
    if (!course) return
    setPublishing(true)
    try {
      const assigned = await setCoursePublished(course.id, !published)
      show(
        published
          ? t.unpublishedToast(course.name)
          : t.publishedToast(course.name, assigned),
      )
    } catch (error) {
      show(error instanceof Error ? error.message : t.publishFailed)
    } finally {
      setPublishing(false)
    }
  }

  async function handleSaveDetails() {
    if (!course) return
    setSavingDetails(true)
    try {
      await saveCourseDetails(course.id, draft)
      show(t.detail.savedToast)
    } catch (error) {
      show(error instanceof Error ? error.message : t.detail.saveFailed)
    } finally {
      setSavingDetails(false)
    }
  }

  async function handleFile(file: File | null) {
    if (!course || !file) return
    if (file.size > api.TRAINING_MAX_BYTES) {
      show(t.detail.materialTooBig)
      setPickerKey((n) => n + 1)
      return
    }
    setUploading(true)
    try {
      await setCourseContent(course.id, file)
      show(t.detail.materialUploaded(file.name))
    } catch (error) {
      show(error instanceof Error ? error.message : t.detail.materialFailed)
    } finally {
      setUploading(false)
      // The picker still holds the old choice, and it cannot be cleared by
      // assignment, so it is remounted.
      setPickerKey((n) => n + 1)
    }
  }

  async function handleRemoveFile() {
    if (!course) return
    setUploading(true)
    try {
      await setCourseContent(course.id, null)
      show(t.detail.materialRemoved)
    } catch (error) {
      show(error instanceof Error ? error.message : t.detail.materialFailed)
    } finally {
      setUploading(false)
    }
  }

  /*
    The bucket is private, so there is no URL to put in an href up front. One
    is signed on the click and opened; a URL signed on render would be spent
    on every page view and stale by the time anyone used it.
  */
  async function openFile() {
    if (!course?.contentPath) return
    try {
      const url = await api.courseContentUrl(course.contentPath)
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      show(error instanceof Error ? error.message : t.detail.materialOpenFailed)
    }
  }

  async function handleRemove(learner: Learner) {
    setRemoving(learner.assignmentId)
    try {
      await unassignCourse(learner.assignmentId)
      show(t.detail.removedToast(learner.driverName))
    } catch (error) {
      show(error instanceof Error ? error.message : t.detail.removeFailed)
    } finally {
      setRemoving(null)
    }
  }

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
      actions={
        <>
          {/*
            A draft course is invisible in the driver app, which reads only
            published rows. Without this the builder was a dead end.
          */}
          <Button
            size="sm"
            variant={published ? 'secondary' : 'primary'}
            loading={publishing}
            onClick={() => void togglePublished()}
          >
            {published ? t.unpublish : t.publish}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setAssigning(true)}>
            {t.detail.assign}
          </Button>
        </>
      }
    >
      {/*
        The one thing that made a finished-looking course reach nobody. Two
        separate steps have to happen — publish, then assign — and neither is
        obvious from a screen that already shows a course sitting there.
      */}
      {!published && (
        <div className="mb-5">
          <Alert tone="warning">{t.draftHint}</Alert>
        </div>
      )}

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

        <div className="grid gap-5">
          <Panel title={t.detail.editDetails} hint={t.detail.editHint}>
            <div className="flex flex-col gap-4 px-5 py-4">
              <Textarea
                label={t.detail.description}
                value={draft.description}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, description: event.target.value }))
                }
              />
              <Field
                label={STRINGS.forms_common.courseFields.length}
                hint={STRINGS.forms_common.courseFields.lengthHint}
                type="number"
                min={1}
                value={draft.lengthMinutes}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, lengthMinutes: event.target.value }))
                }
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  loading={savingDetails}
                  disabled={
                    draft.description === loadedDescription &&
                    draft.lengthMinutes === loadedLength
                  }
                  onClick={() => void handleSaveDetails()}
                >
                  {STRINGS.dialog.save}
                </Button>
              </div>
            </div>
          </Panel>

          <Panel title={t.detail.material}>
            <div className="flex flex-col gap-3 px-5 py-4">
              {course.contentPath ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => void openFile()}>
                    {t.detail.materialOpen}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={uploading}
                    onClick={() => void handleRemoveFile()}
                  >
                    {t.detail.materialRemove}
                  </Button>
                </div>
              ) : (
                <p className="text-[13px] text-ink-3">
                  {t.detail.materialNone} — {t.detail.materialNoneHint}
                </p>
              )}
              <FileField
                key={pickerKey}
                label={course.contentPath ? t.detail.materialReplace : t.detail.materialAdd}
                hint={STRINGS.forms_common.courseFields.fileHint}
                accept={api.TRAINING_MIME_TYPES.join(',')}
                onChange={(file) => void handleFile(file)}
              />
            </div>
          </Panel>

          <Panel title={t.detail.learnersTitle} hint={t.detail.learnersHint}>
          {course.learners.length === 0 ? (
            <EmptyState title={t.detail.noLearners} hint={t.detail.noLearnersHint} />
          ) : (
            <ul className="divide-y divide-line">
              {course.learners.map((learner) => {
                const due = formatDue(learner.dueOn)
                return (
                  <li key={learner.assignmentId} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        to={hrefForDriverName(drivers, learner.driverName)}
                        className="block truncate text-[13.5px] font-medium text-ink hover:text-accent"
                      >
                        {learner.driverName}
                      </Link>
                      {/* A due date only when one was set. "No deadline" is a
                          real answer and better than inventing one. */}
                      {/*
                        Time spent sits next to the deadline because together
                        they answer the only question worth asking: is this
                        driver going to finish it in time. "In progress" on its
                        own does not.
                      */}
                      <p className="text-[12px] text-ink-4">
                        {due ? t.detail.dueBy(due) : t.detail.noDeadline}
                        {learner.secondsSpent > 0
                          ? ` · ${t.detail.timeSpentValue(learner.secondsSpent)}`
                          : ''}
                      </p>
                    </div>
                    <Badge tone={LEARNER_TONE[learner.status]}>
                      {t.detail.learnerStatus[learner.status]}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={removing === learner.assignmentId}
                      onClick={() => void handleRemove(learner)}
                    >
                      {t.detail.remove}
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
          </Panel>
        </div>
      </div>

      <AssignCourseDialog
        open={assigning}
        course={course}
        onClose={() => setAssigning(false)}
      />
    </DetailShell>
  )
}
