import { useState, type FormEvent } from 'react'
import { STRINGS } from '../../../constants'
import { Button, Field, FormGrid, FormRow, Modal, Select, useToast } from '../../../components/ui'
import { useDepotOptions, useFleetData, type NewForm } from '../../fleet-data'

const t = STRINGS.forms_common
const d = STRINGS.dialog

const EMPTY: NewForm = { name: '', depotId: '' }

export function NewFormDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addForm } = useFleetData()

  /** Empty means every driver in the organisation, not "nobody". */
  const depotOptions = useDepotOptions(STRINGS.forms.allDrivers)
  const { show } = useToast()
  const [values, setValues] = useState<NewForm>(EMPTY)
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!values.name.trim()) {
      setError(d.required)
      return
    }

    // A real write, so it can fail. The dialog keeps what was typed.
    setSaving(true)
    try {
      await addForm(values)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.formFailed)
      return
    } finally {
      setSaving(false)
    }

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
          <Button type="submit" form="new-form-form" loading={saving}>
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
              options={depotOptions}
              value={values.depotId}
              onChange={(e) => setValues((c) => ({ ...c, depotId: e.target.value }))}
            />
          </FormRow>
        </FormGrid>
      </form>
    </Modal>
  )
}
