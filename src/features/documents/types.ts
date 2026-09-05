/**
 * Trip paperwork captured in the cab: bills of lading, delivery proofs,
 * receipts, fuel dockets.
 *
 * Compliance paperwork — licences, insurance — lives in the same table but is
 * read by the driver and vehicle screens, not here. `category` in the database
 * is what keeps them apart.
 */

export type DocumentRow = {
  id: string
  name: string
  kind: string
  /**
   * Which half of the filing cabinet it is in.
   *
   * Compliance is what keeps a driver and a truck legal — licences, medicals,
   * insurance — filed by the office and watched for expiry. Trip paperwork
   * comes back from a job: a signed delivery note, a fuel docket. They are
   * read for completely different reasons, which is why they are separate tabs
   * rather than one list.
   */
  category: 'compliance' | 'trip'
  /** Already formatted, or null. Only compliance paperwork expires. */
  expires: string | null
  /**
   * How urgent that date is.
   *
   * Worked out on load rather than in the cell, so the table is not doing date
   * arithmetic on every render — and so "expired" means the same thing here as
   * it does on the dashboard.
   */
  expiryState: 'expired' | 'soon' | 'ok' | null
  driver: string
  vehicle: string
  /** Already formatted. */
  uploaded: string
  /** Null when nothing recorded a size. */
  sizeKb: number | null
  /** Null when nothing recorded one. The preview falls back to a download. */
  mimeType: string | null
  /** The number on it — a licence number, a policy number. */
  reference: string | null
  issuingAuthority: string | null
  /** Already formatted, or null. */
  issued: string | null
  /**
   * Where the file is in storage. Null means only a record was filed and
   * there is nothing to open — the download has to say so rather than hand
   * over a stand-in file.
   */
  storagePath: string | null
}
