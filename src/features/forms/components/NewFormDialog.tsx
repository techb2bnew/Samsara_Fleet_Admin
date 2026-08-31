import { useState, type FormEvent } from 'react'
import { STRINGS } from '../../../constants'
import { Button, Field, FormGrid, FormRow, Modal, Select, useToast } from '../../../components/ui'
import { useFleetData, type NewForm } from '../../fleet-data'

const t = STRINGS.forms_common
const d = STRINGS.dialog

const TARGETS = [
  { value: 'Not assigned', label: 'Not assigned' },
  { value: 'All drivers', label: 'All drivers' },
  { value: 'Pune depot', label: 'Pune depot' },
  { value: 'Nashik depot', label: 'Nashik depot' },
]

const EMPTY: NewForm = { name: '', assignedTo: TARGETS[0].value }

export function NewFormDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addForm } = useFleetData()
  const { show } = useToast()
  const [values, setValues] = useState<NewForm>(EMPTY)
  const [error, setError] = useState<string>()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!values.name.trim()) {
      setError(d.required)
      return
    }
    addForm(values)
    show(t.formToast(values.name.trim()))
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
      title={t.formTitle}
      description={t.formDescription}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            {d.cancel}
          </Button>
          <Button type="submit" form="new-form-form">
            {t.formSubmit}
          </Button>
        </>
      }
    >
      <form id="new-form-form" onSubmit={handleSubmit} noValidate>
        <FormGrid>
          <FormRow>
            <Field
              label={t.formFields.name}
              placeholder="Monthly trailer check"
              value={values.name}
              onChange={(e) => setValues((c) => ({ ...c, name: e.target.value }))}
              error={error}
            />
          </FormRow>
          <FormRow>
            <Select
              label={t.formFields.assignedTo}
              options={TARGETS}
              value={values.assignedTo}
              onChange={(e) => setValues((c) => ({ ...c, assignedTo: e.target.value }))}
            />
          </FormRow>
        </FormGrid>
      </form>
    </Modal>
  )
}
