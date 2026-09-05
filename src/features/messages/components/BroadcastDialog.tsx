import { useMemo, useState, type FormEvent } from 'react'
import { STRINGS } from '../../../constants'
import { Button, FormGrid, FormRow, Modal, Select, Textarea, useToast } from '../../../components/ui'
import { useFleetData } from '../../fleet-data'

const t = STRINGS.messages
const d = STRINGS.dialog

/**
 * "all" and "onDuty" are fixed; anything else is a depot name straight from
 * the database. Hardcoding the depots meant the list was wrong the moment a
 * third one opened, and the filter compared against a name that might not
 * exist.
 */
type Audience = 'all' | 'onDuty' | (string & {})

export function BroadcastDialog({
  open,
  onClose,
  onSend,
}: {
  open: boolean
  onClose: () => void
  onSend: (body: string, recipients: string[]) => void
}) {
  const { drivers, depots } = useFleetData()
  const { show } = useToast()

  const [audience, setAudience] = useState<Audience>('all')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string>()

  /**
   * The recipient count is shown before sending, not after. A broadcast that
   * reaches the wrong depot cannot be recalled from forty phones.
   */
  const recipients = useMemo(() => {
    if (audience === 'all') return drivers
    if (audience === 'onDuty') {
      // Duty status comes from hours of service. Where nothing is recording
      // it, nobody matches — better than broadcasting to the whole depot
      // under a label that says on duty.
      return drivers.filter((driver) => driver.duty === 'driving' || driver.duty === 'on_duty')
    }
    return drivers.filter((driver) => driver.depot?.id === audience)
  }, [audience, drivers])

  const audienceOptions = useMemo(
    () => [
      { value: 'all', label: t.broadcastAudience.all },
      { value: 'onDuty', label: t.broadcastAudience.onDuty },
      ...depots.map((depot) => ({ value: depot.id, label: depot.name })),
    ],
    [depots],
  )

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!message.trim()) {
      setError(t.broadcastEmpty)
      return
    }
    onSend(message.trim(), recipients.map((driver) => driver.name))
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
              options={audienceOptions}
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
