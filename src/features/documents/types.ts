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
  driver: string
  vehicle: string
  /** Already formatted. */
  uploaded: string
  /** Null when nothing recorded a size. */
  sizeKb: number | null
  /**
   * Where the file is in storage. Null means only a record was filed and
   * there is nothing to open — the download has to say so rather than hand
   * over a stand-in file.
   */
  storagePath: string | null
}
