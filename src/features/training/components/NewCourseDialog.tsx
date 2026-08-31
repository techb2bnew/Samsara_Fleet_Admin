import { useState, type FormEvent } from 'react'
import { STRINGS } from '../../../constants'
import { Button, Field, FormGrid, FormRow, Modal, Select, useToast } from '../../../components/ui'
import { useFleetData, type NewCourse } from '../../fleet-data'

const t = STRINGS.forms_common
const d = STRINGS.dialog

const TARGETS = [
  { value: 'Nobody yet', label: 'Nobody yet' },
  { value: 'All drivers', label: 'All drivers' },
  { value: 'Pune depot', label: 'Pune depot' },
  { value: 'Nashik depot', label: 'Nashik depot' },
]

const EMPTY: NewCourse = { name: '', lengthMinutes: '10', assignTo: TARGETS[0].value }

export function NewCourseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addCourse } = useFleetData()
  const { show } = useToast()
  const [values, setValues] = useState<NewCourse>(EMPTY)
  const [error, setError] = useState<string>()

  const set = (key: keyof NewCourse) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }))

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!values.name.trim()) {
      setError(d.required)
      return
    }
    addCourse(values)
    show(t.courseToast(values.name.trim()))
    setValues(EMPTY)
    setError(undefined)
    onClose()
  }

  function handleClose() {
    setValues(EMPTY)
    setError(undefined)
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
          <Button type="submit" form="new-course-form">
            {t.courseSubmit}
          </Button>
        </>
      }
    >
      <form id="new-course-form" onSubmit={handleSubmit} noValidate>
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
          <Field
            label={t.courseFields.length}
            type="number"
            min={1}
            value={values.lengthMinutes}
            onChange={set('lengthMinutes')}
          />
          <Select
            label={t.courseFields.assignTo}
            options={TARGETS}
            value={values.assignTo}
            onChange={set('assignTo')}
          />
        </FormGrid>
      </form>
    </Modal>
  )
}
