/**
 * A form the office has built, as the list shows it.
 *
 * `fields` is a count and `submissions` a total across every version of the
 * same form — the list answers "is this being used?", and the builder answers
 * what is on it.
 */
export type FormDef = {
  id: string
  name: string
  fields: number
  version: number
  status: 'published' | 'draft'
  assignedTo: string
  submissions: number
  /** Pre-formatted: "Just now", "12 Aug 2026". */
  updated: string
}

/** One question on a form. The phone renders these in order. */
export type FormField = {
  id: string
  label: string
  type: string
  required: boolean
}

/**
 * The field types the form builder offers.
 *
 * Configuration, not data: this is what the product supports, and the phone
 * has to be able to render every one of them.
 */

export const FIELD_TYPES = [
  'Text', 'Number', 'Dropdown', 'Multi-select', 'Checkbox',
  'Date & time', 'Photo', 'Signature', 'Barcode', 'Location',
]

/**
 * What a brand-new form starts with.
 *
 * A product decision, not demo data: every form the office builds begins with
 * these three, because a form that captures nothing is not worth publishing.
 * This feeds the real createForm call.
 */
export const DEFAULT_NEW_FORM_FIELDS: Array<Omit<FormField, 'id'>> = [
  { label: 'Notes', type: 'Text', required: false },
  { label: 'Photo', type: 'Photo', required: false },
  { label: 'Signature', type: 'Signature', required: true },
]
