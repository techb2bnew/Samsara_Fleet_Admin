import { useMemo, useState, type FormEvent } from 'react'
import { STRINGS } from '../../../constants'
import { Button, FormGrid, FormRow, Modal, Select, Textarea, useToast } from '../../../components/ui'
import { useFleetData } from '../../fleet-data'

const t = STRINGS.messages
const d = STRINGS.dialog

type Audience = keyof typeof t.broadcastAudience

const AUDIENCES = (Object.keys(t.broadcastAudience) as Audience[]).map((key) => ({
  value: key,
  label: t.broadcastAudience[key],
}))

export function BroadcastDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { drivers } = useFleetData()
  const { show } = useToast()

  const [audience, setAudience] = useState<Audience>('all')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string>()

  /**
   * The recipient count is shown before sending, not after. A broadcast that
   * reaches the wrong depot cannot be recalled from forty phones.
   */
  const recipients = useMemo(() => {
    switch (audience) {
      case 'pune':
        return drivers.filter((driver) => driver.terminal === 'Pune depot')
      case 'nashik':
        return drivers.filter((driver) => driver.terminal === 'Nashik depot')
      case 'onDuty':
        return drivers.filter((driver) => driver.status === 'driving' || driver.status === 'on_duty')
      default:
        return drivers
    }
  }, [audience, drivers])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!message.trim()) {
      setError(t.broadcastEmpty)
      return
    }
    show(t.broadcastToast(recipients.length))
    setMessage('')
    setError(undefined)
    onClose()
  }

  function handleClose() {
    setMessage('')
    setError(undefined)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t.broadcastTitle}
      description={t.broadcastDescription}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            {d.cancel}
          </Button>
          <Button type="submit" form="broadcast-form" disabled={recipients.length === 0}>
            {t.broadcastSubmit}
          </Button>
        </>
      }
    >
      <form id="broadcast-form" onSubmit={handleSubmit} noValidate>
        <FormGrid>
          <FormRow>
            <Select
              label={t.broadcastFields.audience}
              options={AUDIENCES}
              value={audience}
              onChange={(e) => setAudience(e.target.value as Audience)}
              hint={t.broadcastToast(recipients.length).replace('Message sent to', 'Reaches')}
            />
          </FormRow>
          <FormRow>
            <Textarea
              label={t.broadcastFields.message}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              error={error}
              placeholder="Depot closes at 18:00 today — plan your last drop accordingly."
            />
          </FormRow>
        </FormGrid>
      </form>
    </Modal>
  )
}
