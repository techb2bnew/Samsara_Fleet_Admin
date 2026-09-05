import { useState, type FormEvent } from 'react'
import { STRINGS } from '../../../constants'
import {
  Button,
  Field,
  FileField,
  FormGrid,
  FormRow,
  Modal,
  Select,
  Textarea,
  useToast,
} from '../../../components/ui'
import * as api from '../../../supabase/api'
import { useDepotOptions, useFleetData, type NewCourse } from '../../fleet-data'

const t = STRINGS.forms_common
const d = STRINGS.dialog

const EMPTY: NewCourse = { name: '', description: '', lengthMinutes: '10', depotId: '' }

export function NewCourseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addCourse } = useFleetData()

  /** Empty means every driver in the organisation. */
  const depotOptions = useDepotOptions(STRINGS.training.allDrivers)
  const { show } = useToast()
  const [values, setValues] = useState<NewCourse>(EMPTY)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  /*
    The file input is remounted on each open so a previously chosen file is not
    still sitting in the picker after the dialog is closed and reopened. An
    input[type=file] cannot be cleared by setting its value, so the key is the
    only honest way to reset it.
  */
  const [pickerKey, setPickerKey] = useState(0)

  const set = (key: keyof NewCourse) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }))

  function reset() {
    setValues(EMPTY)
    setFile(null)
    setError(undefined)
    setPickerKey((n) => n + 1)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!values.name.trim()) {
      setError(d.required)
      return
    }
    if (file && file.size > api.TRAINING_MAX_BYTES) {
      setError(STRINGS.training.detail.materialTooBig)
      return
    }

    /*
      Awaited, unlike the old version. Creating the course and uploading its
      file are two round trips, and closing the dialog between them left the
      user looking at a course with no material and no idea why.
    */
    setSaving(true)
    try {
      await addCourse(values, file)
      show(t.courseToast(values.name.trim()))
      reset()
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.courseFailed)
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t.courseTitle}
      description={t.courseDescription}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            {d.cancel}
          </Button>
          <Button type="submit" form="new-course-form" loading={saving}>
            {t.courseSubmit}
          </Button>
        </>
      }
    >
      <form id="new-course-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
        <FormGrid>
          <FormRow>
            <Field
              label={t.courseFields.name}
              placeholder="Monsoon driving refresher"
              value={values.name}
              onChange={set('name')}
              error={error}
            />
          </FormRow>
          <FormRow>
            <Textarea
              label={t.courseFields.description}
              hint={t.courseFields.descriptionHint}
              value={values.description}
              onChange={set('description')}
            />
          </FormRow>
          <FormRow>
            <FileField
              key={pickerKey}
              label={t.courseFields.file}
              hint={t.courseFields.fileHint}
              accept={api.TRAINING_MIME_TYPES.join(',')}
              onChange={setFile}
            />
          </FormRow>
          <Field
            label={t.courseFields.length}
            hint={t.courseFields.lengthHint}
            type="number"
            min={1}
            value={values.lengthMinutes}
            onChange={set('lengthMinutes')}
          />
          {/*
            "Visible to", not "Assign to". This only decides who can see the
            course; giving it to a driver is a row in course_assignments,
            written from the course's own screen. The old label read as though
            the job was already done, so courses were published to nobody.
          */}
          <Select
            label={t.courseFields.visibleTo}
            hint={t.courseFields.visibleToHint}
            options={depotOptions}
            value={values.depotId}
            onChange={set('depotId')}
          />
        </FormGrid>
      </form>
    </Modal>
  )
}
