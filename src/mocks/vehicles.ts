/** Vehicles, trailers and repair jobs (A05). */
import type { Tone } from '../constants'

export type Vehicle = {
  id: string
  name: string
  plate: string
  makeModel: string
  year: number
  status: 'active' | 'in_maintenance' | 'out_of_service' | 'retired'
  driver: string | null
  odometerKm: number
  nextServiceKm: number
  serviceOverdueKm: number
}

export const MOCK_VEHICLES: Vehicle[] = [
  { id: 'v1', name: 'Truck 214', plate: 'MH 12 QR 4471', makeModel: 'Tata Prima 4028', year: 2022, status: 'active', driver: 'Ravi Deshmukh', odometerKm: 184_220, nextServiceKm: 190_000, serviceOverdueKm: 0 },
  { id: 'v2', name: 'Truck 187', plate: 'MH 12 KL 2210', makeModel: 'Ashok Leyland 3520', year: 2021, status: 'active', driver: 'Amit Verma', odometerKm: 241_880, nextServiceKm: 250_000, serviceOverdueKm: 0 },
  { id: 'v3', name: 'Truck 133', plate: 'MH 15 AB 8890', makeModel: 'Tata Signa 4825', year: 2020, status: 'active', driver: 'Sunita Rao', odometerKm: 321_240, nextServiceKm: 320_000, serviceOverdueKm: 1_240 },
  { id: 'v4', name: 'Truck 108', plate: 'MH 15 CD 1176', makeModel: 'Ashok Leyland 2820', year: 2019, status: 'out_of_service', driver: null, odometerKm: 398_500, nextServiceKm: 400_000, serviceOverdueKm: 0 },
  { id: 'v5', name: 'Truck 202', plate: 'MH 12 EF 3345', makeModel: 'Tata Prima 4028', year: 2023, status: 'active', driver: 'Dev Singh', odometerKm: 96_410, nextServiceKm: 100_000, serviceOverdueKm: 0 },
  { id: 'v6', name: 'Truck 155', plate: 'MH 12 GH 7712', makeModel: 'BharatBenz 3528', year: 2022, status: 'active', driver: 'Lata Kulkarni', odometerKm: 152_990, nextServiceKm: 160_000, serviceOverdueKm: 0 },
  { id: 'v7', name: 'Truck 176', plate: 'MH 15 IJ 5528', makeModel: 'Tata Signa 4025', year: 2021, status: 'in_maintenance', driver: null, odometerKm: 268_130, nextServiceKm: 270_000, serviceOverdueKm: 0 },
  { id: 'v8', name: 'Trailer T-12', plate: 'MH 12 TR 0092', makeModel: 'Flatbed 40ft', year: 2020, status: 'active', driver: null, odometerKm: 0, nextServiceKm: 0, serviceOverdueKm: 0 },
]

export const VEHICLE_STATUS_LABEL: Record<Vehicle['status'], string> = {
  active: 'Active',
  in_maintenance: 'In maintenance',
  out_of_service: 'Out of service',
  retired: 'Retired',
}

export const VEHICLE_STATUS_TONE: Record<Vehicle['status'], Tone> = {
  active: 'success',
  in_maintenance: 'warning',
  out_of_service: 'danger',
  retired: 'neutral',
}

export type WorkOrder = {
  id: string
  reference: string
  vehicle: string
  title: string
  status: 'open' | 'assigned' | 'in_progress' | 'completed'
  mechanic: string | null
  opened: string
  costRupees: number
}

export const MOCK_WORK_ORDERS: WorkOrder[] = [
  { id: 'w1', reference: 'WO-2304', vehicle: 'Truck 108', title: 'Brake fault — front axle', status: 'in_progress', mechanic: 'Kabir Nair', opened: 'Today, 07:12', costRupees: 0 },
  { id: 'w2', reference: 'WO-2303', vehicle: 'Truck 176', title: 'Scheduled 270,000 km service', status: 'assigned', mechanic: 'Kabir Nair', opened: 'Yesterday', costRupees: 0 },
  { id: 'w3', reference: 'WO-2301', vehicle: 'Truck 133', title: 'Replace worn tyres, rear left', status: 'open', mechanic: null, opened: '2 days ago', costRupees: 0 },
  { id: 'w4', reference: 'WO-2291', vehicle: 'Truck 108', title: 'Coolant leak', status: 'completed', mechanic: 'Kabir Nair', opened: '5 days ago', costRupees: 18_400 },
]

export const WORK_ORDER_TONE: Record<WorkOrder['status'], Tone> = {
  open: 'danger',
  assigned: 'warning',
  in_progress: 'accent',
  completed: 'success',
}

export const WORK_ORDER_LABEL: Record<WorkOrder['status'], string> = {
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In progress',
  completed: 'Completed',
}
