import { useState, type FormEvent } from 'react'
import { STRINGS } from '../../../constants'
import { Button, Field, FormGrid, Modal, Select, useToast } from '../../../components/ui'
import { useFleetData, type NewVehicle } from '../../fleet-data'

const t = STRINGS.forms_common
const d = STRINGS.dialog

const TERMINALS = [
  { value: 'Pune depot', label: 'Pune depot' },
  { value: 'Nashik depot', label: 'Nashik depot' },
]

const EMPTY: NewVehicle = {
  name: '',
  plate: '',
  makeModel: '',
  year: '',
  terminal: TERMINALS[0].value,
  odometerKm: '',
}

export function AddVehicleDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addVehicle } = useFleetData()
  const { show } = useToast()
  const [values, setValues] = useState<NewVehicle>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof NewVehicle, string>>>({})

  const set = (key: keyof NewVehicle) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }))

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const next: typeof errors = {}
    if (!values.name.trim()) next.name = d.required
    if (!values.plate.trim()) next.plate = d.required

    setErrors(next)
    if (Object.keys(next).length > 0) return

    addVehicle(values)
    show(t.addVehicleToast(values.name.trim()))
    setValues(EMPTY)
    setErrors({})
    onClose()
  }

  function handleClose() {
    setValues(EMPTY)
    setErrors({})
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t.addVehicleTitle}
      description={t.addVehicleDescription}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            {d.cancel}
          </Button>
          <Button type="submit" form="add-vehicle-form">
            {t.addVehicleSubmit}
          </Button>
        </>
      }
    >
      <form id="add-vehicle-form" onSubmit={handleSubmit} noValidate>
        <FormGrid>
          <Field
            label={t.vehicleFields.name}
            placeholder={t.vehicleFields.namePlaceholder}
            value={values.name}
            onChange={set('name')}
            error={errors.name}
          />
          <Field
            label={t.vehicleFields.plate}
            placeholder="MH 12 AB 0000"
            value={values.plate}
            onChange={set('plate')}
            error={errors.plate}
          />
          <Field
            label={t.vehicleFields.makeModel}
            placeholder="Tata Prima 4028"
            value={values.makeModel}
            onChange={set('makeModel')}
          />
          <Field
            label={t.vehicleFields.year}
            type="number"
            placeholder="2024"
            value={values.year}
            onChange={set('year')}
          />
          <Select
            label={t.vehicleFields.terminal}
            options={TERMINALS}
            value={values.terminal}
            onChange={set('terminal')}
          />
          <Field
            label={t.vehicleFields.odometer}
            type="number"
            placeholder="0"
            value={values.odometerKm}
            onChange={set('odometerKm')}
            hint="Next service is set 20,000 km ahead."
          />
        </FormGrid>
      </form>
    </Modal>
  )
}
