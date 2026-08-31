/** Dispatch (A08), forms (A09), messages (A10) and documents (A13). */
import type { Tone } from '../constants'

export type Route = {
  id: string
  reference: string
  driver: string
  vehicle: string
  stopsDone: number
  stopsTotal: number
  status: 'planned' | 'in_progress' | 'late' | 'completed'
  eta: string
}

export const MOCK_ROUTES: Route[] = [
  { id: 'r1', reference: 'NL-4471', driver: 'Amit Verma', vehicle: 'Truck 187', stopsDone: 5, stopsTotal: 8, status: 'late', eta: '40 min behind' },
  { id: 'r2', reference: 'NL-4482', driver: 'Dev Singh', vehicle: 'Truck 202', stopsDone: 3, stopsTotal: 9, status: 'in_progress', eta: 'On time' },
  { id: 'r3', reference: 'NL-4479', driver: 'Lata Kulkarni', vehicle: 'Truck 155', stopsDone: 7, stopsTotal: 7, status: 'completed', eta: 'Finished 14:20' },
  { id: 'r4', reference: 'NL-4488', driver: 'Neha Joshi', vehicle: 'Truck 176', stopsDone: 0, stopsTotal: 6, status: 'planned', eta: 'Starts 15:00' },
  { id: 'r5', reference: 'NL-4465', driver: 'Ravi Deshmukh', vehicle: 'Truck 214', stopsDone: 6, stopsTotal: 6, status: 'completed', eta: 'Finished 11:05' },
]

export const ROUTE_TONE: Record<Route['status'], Tone> = {
  planned: 'neutral',
  in_progress: 'accent',
  late: 'danger',
  completed: 'success',
}

export const ROUTE_LABEL: Record<Route['status'], string> = {
  planned: 'Planned',
  in_progress: 'In progress',
  late: 'Running late',
  completed: 'Completed',
}

export type RouteStop = {
  id: string
  sequence: number
  name: string
  address: string
  window: string
  arrivedAt: string | null
}

/** Stops for each route, in visiting order. */
export const MOCK_ROUTE_STOPS: Record<string, RouteStop[]> = {
  r1: [
    { id: 's1', sequence: 1, name: 'Shreeji Traders', address: 'MIDC Bhosari, Pune', window: '08:00 – 09:00', arrivedAt: '08:12' },
    { id: 's2', sequence: 2, name: 'Kalyani Steel', address: 'Chakan, Pune', window: '09:30 – 10:30', arrivedAt: '09:48' },
    { id: 's3', sequence: 3, name: 'Deccan Warehousing', address: 'Talegaon, Pune', window: '11:00 – 12:00', arrivedAt: '11:35' },
    { id: 's4', sequence: 4, name: 'Sai Logistics Hub', address: 'Hinjawadi, Pune', window: '12:30 – 13:30', arrivedAt: '13:20' },
    { id: 's5', sequence: 5, name: 'Ratna Distributors', address: 'Baner, Pune', window: '14:00 – 15:00', arrivedAt: '14:55' },
    { id: 's6', sequence: 6, name: 'Ganesh Enterprises', address: 'Kothrud, Pune', window: '15:30 – 16:30', arrivedAt: null },
    { id: 's7', sequence: 7, name: 'Mahalaxmi Stores', address: 'Karve Nagar, Pune', window: '17:00 – 18:00', arrivedAt: null },
    { id: 's8', sequence: 8, name: 'Northline Pune depot', address: 'Hadapsar, Pune', window: '18:30 – 19:00', arrivedAt: null },
  ],
  r2: [
    { id: 's9', sequence: 1, name: 'Nashik Cold Store', address: 'Ambad MIDC, Nashik', window: '07:30 – 08:30', arrivedAt: '07:41' },
    { id: 's10', sequence: 2, name: 'Godavari Agro', address: 'Satpur, Nashik', window: '09:00 – 10:00', arrivedAt: '09:15' },
    { id: 's11', sequence: 3, name: 'Sula Logistics', address: 'Gangapur Rd, Nashik', window: '10:30 – 11:30', arrivedAt: '10:52' },
    { id: 's12', sequence: 4, name: 'Trimbak Traders', address: 'Trimbak Rd, Nashik', window: '12:00 – 13:00', arrivedAt: null },
    { id: 's13', sequence: 5, name: 'Panchavati Wholesale', address: 'Panchavati, Nashik', window: '13:30 – 14:30', arrivedAt: null },
    { id: 's14', sequence: 6, name: 'Igatpuri Depot', address: 'Igatpuri', window: '15:30 – 16:30', arrivedAt: null },
    { id: 's15', sequence: 7, name: 'Sinnar Industrial', address: 'Sinnar, Nashik', window: '17:00 – 18:00', arrivedAt: null },
    { id: 's16', sequence: 8, name: 'Deolali Camp Stores', address: 'Deolali, Nashik', window: '18:30 – 19:00', arrivedAt: null },
    { id: 's17', sequence: 9, name: 'Northline Nashik depot', address: 'Ambad, Nashik', window: '19:30 – 20:00', arrivedAt: null },
  ],
}

/* ------------------------------------------------------------------- forms */

export type FormDef = {
  id: string
  name: string
  fields: number
  version: number
  status: 'published' | 'draft'
  assignedTo: string
  submissions: number
  updated: string
}

export const MOCK_FORMS: FormDef[] = [
  { id: 'f1', name: 'Daily pre-trip inspection', fields: 24, version: 4, status: 'published', assignedTo: 'All drivers', submissions: 1_284, updated: '12 Aug' },
  { id: 'f2', name: 'Delivery proof', fields: 6, version: 2, status: 'published', assignedTo: 'All drivers', submissions: 3_902, updated: '02 Aug' },
  { id: 'f3', name: 'Fuel receipt', fields: 5, version: 1, status: 'published', assignedTo: 'Pune depot', submissions: 611, updated: '19 Jul' },
  { id: 'f4', name: 'Incident report', fields: 15, version: 3, status: 'draft', assignedTo: 'Not assigned', submissions: 0, updated: 'Yesterday' },
]

export const FIELD_TYPES = [
  'Text', 'Number', 'Dropdown', 'Multi-select', 'Checkbox',
  'Date & time', 'Photo', 'Signature', 'Barcode', 'Location',
]

/* ---------------------------------------------------------------- messages */

export type Thread = {
  id: string
  driver: string
  initials: string
  preview: string
  at: string
  unread: boolean
}

export const MOCK_THREADS: Thread[] = [
  { id: 't1', driver: 'Dev Singh', initials: 'DS', preview: 'Held up at the Pune depot, gate queue is about an hour.', at: '09:12', unread: true },
  { id: 't2', driver: 'Amit Verma', initials: 'AV', preview: 'Stop 6 customer is closed, what should I do?', at: '08:48', unread: true },
  { id: 't3', driver: 'Sunita Rao', initials: 'SR', preview: 'Understood, will do the inspection before leaving.', at: 'Yesterday', unread: false },
  { id: 't4', driver: 'Lata Kulkarni', initials: 'LK', preview: 'Route finished, all 7 stops signed.', at: 'Yesterday', unread: false },
]

export type Message = {
  id: string
  from: 'driver' | 'office'
  body: string
  at: string
}

export const MOCK_MESSAGES: Record<string, Message[]> = {
  t1: [
    { id: 'm1', from: 'office', body: 'Morning Dev — you are on NL-4482 today, 9 stops.', at: '07:02' },
    { id: 'm2', from: 'driver', body: 'Got it. Loading now.', at: '07:15' },
    { id: 'm3', from: 'driver', body: 'Held up at the Pune depot, gate queue is about an hour.', at: '09:12' },
  ],
}

/* --------------------------------------------------------------- documents */

export type DocumentRow = {
  id: string
  name: string
  kind: 'Bill of lading' | 'Receipt' | 'Fuel docket' | 'Proof of delivery'
  driver: string
  vehicle: string
  uploaded: string
  sizeKb: number
}

export const MOCK_DOCUMENTS: DocumentRow[] = [
  { id: 'doc1', name: 'BOL-88213.jpg', kind: 'Bill of lading', driver: 'Amit Verma', vehicle: 'Truck 187', uploaded: 'Today, 09:41', sizeKb: 842 },
  { id: 'doc2', name: 'POD-NL4479-stop7.jpg', kind: 'Proof of delivery', driver: 'Lata Kulkarni', vehicle: 'Truck 155', uploaded: 'Today, 08:20', sizeKb: 615 },
  { id: 'doc3', name: 'fuel-hpcl-3391.jpg', kind: 'Fuel docket', driver: 'Dev Singh', vehicle: 'Truck 202', uploaded: 'Yesterday', sizeKb: 402 },
  { id: 'doc4', name: 'toll-receipt-2210.jpg', kind: 'Receipt', driver: 'Ravi Deshmukh', vehicle: 'Truck 214', uploaded: 'Yesterday', sizeKb: 288 },
  { id: 'doc5', name: 'BOL-88190.jpg', kind: 'Bill of lading', driver: 'Neha Joshi', vehicle: 'Truck 176', uploaded: '29 Aug', sizeKb: 911 },
]
