/** Staff accounts (A01) and drivers (A04). One roster, two audiences. */
import type { Tone } from '../constants'

export type StaffUser = {
  id: string
  name: string
  initials: string
  email: string
  role: string
  fleet: string
  status: 'active' | 'invited' | 'suspended'
  lastActive: string
}

export const MOCK_STAFF: StaffUser[] = [
  { id: 'u1', name: 'Priya Sharma', initials: 'PS', email: 'priya.sharma@northline.example', role: 'Fleet admin', fleet: 'All fleets', status: 'active', lastActive: '2 minutes ago' },
  { id: 'u2', name: 'Meera Iyer', initials: 'MI', email: 'meera.iyer@northline.example', role: 'Dispatcher', fleet: 'Pune depot', status: 'active', lastActive: '18 minutes ago' },
  { id: 'u3', name: 'Kabir Nair', initials: 'KN', email: 'kabir.nair@northline.example', role: 'Mechanic', fleet: 'Pune depot', status: 'active', lastActive: '1 hour ago' },
  { id: 'u4', name: 'Farah Qureshi', initials: 'FQ', email: 'farah.qureshi@northline.example', role: 'Compliance officer', fleet: 'All fleets', status: 'active', lastActive: '3 hours ago' },
  { id: 'u5', name: 'Rohan Mehta', initials: 'RM', email: 'rohan.mehta@northline.example', role: 'Safety manager', fleet: 'Nashik depot', status: 'active', lastActive: 'Yesterday' },
  { id: 'u6', name: 'Nikhil Rao', initials: 'NR', email: 'nikhil@northline.example', role: 'Dispatcher', fleet: 'Nashik depot', status: 'invited', lastActive: 'Never signed in' },
  { id: 'u7', name: 'Anjali Desai', initials: 'AD', email: 'anjali.desai@northline.example', role: 'Viewer', fleet: 'All fleets', status: 'suspended', lastActive: '3 weeks ago' },
]

export const STAFF_STATUS_TONE: Record<StaffUser['status'], Tone> = {
  active: 'success',
  invited: 'accent',
  suspended: 'danger',
}

export const ROLE_SUMMARY = [
  { key: 'fleet_admin', name: 'Fleet admin', people: 1, description: 'Full control of the organisation.' },
  { key: 'dispatcher', name: 'Dispatcher', people: 2, description: 'Plans routes and messages drivers.' },
  { key: 'compliance_officer', name: 'Compliance officer', people: 1, description: 'Reviews hours logs and violations.' },
  { key: 'safety_manager', name: 'Safety manager', people: 1, description: 'Reviews incidents, assigns coaching.' },
  { key: 'mechanic', name: 'Mechanic', people: 1, description: 'Sees defects and repair jobs.' },
  { key: 'viewer', name: 'Viewer', people: 1, description: 'Read-only access.' },
]

/* ------------------------------------------------------------------ drivers */

export type Driver = {
  id: string
  name: string
  initials: string
  employeeNumber: string
  terminal: string
  status: 'driving' | 'on_duty' | 'resting' | 'off_duty' | 'offline'
  vehicle: string | null
  hoursLeft: string
  licenceExpires: string
  licenceWarning: boolean
  safetyScore: number
}

export const MOCK_DRIVERS: Driver[] = [
  { id: 'd1', name: 'Ravi Deshmukh', initials: 'RD', employeeNumber: 'NL-018', terminal: 'Pune depot', status: 'driving', vehicle: 'Truck 214', hoursLeft: '0:00', licenceExpires: '14 Mar 2029', licenceWarning: false, safetyScore: 71 },
  { id: 'd2', name: 'Amit Verma', initials: 'AV', employeeNumber: 'NL-022', terminal: 'Pune depot', status: 'driving', vehicle: 'Truck 187', hoursLeft: '4:20', licenceExpires: '02 Mar 2031', licenceWarning: false, safetyScore: 94 },
  { id: 'd3', name: 'Sunita Rao', initials: 'SR', employeeNumber: 'NL-007', terminal: 'Nashik depot', status: 'on_duty', vehicle: 'Truck 133', hoursLeft: '6:45', licenceExpires: '09 Sep 2026', licenceWarning: true, safetyScore: 88 },
  { id: 'd4', name: 'Dev Singh', initials: 'DS', employeeNumber: 'NL-031', terminal: 'Pune depot', status: 'resting', vehicle: 'Truck 202', hoursLeft: '9:10', licenceExpires: '21 Jul 2030', licenceWarning: false, safetyScore: 79 },
  { id: 'd5', name: 'Imran Shaikh', initials: 'IS', employeeNumber: 'NL-044', terminal: 'Nashik depot', status: 'off_duty', vehicle: null, hoursLeft: '11:00', licenceExpires: '30 Nov 2028', licenceWarning: false, safetyScore: 91 },
  { id: 'd6', name: 'Lata Kulkarni', initials: 'LK', employeeNumber: 'NL-050', terminal: 'Pune depot', status: 'driving', vehicle: 'Truck 155', hoursLeft: '2:35', licenceExpires: '17 Jan 2030', licenceWarning: false, safetyScore: 96 },
  { id: 'd7', name: 'Manoj Pawar', initials: 'MP', employeeNumber: 'NL-061', terminal: 'Nashik depot', status: 'offline', vehicle: 'Truck 108', hoursLeft: '—', licenceExpires: '05 Jun 2027', licenceWarning: false, safetyScore: 68 },
  { id: 'd8', name: 'Neha Joshi', initials: 'NJ', employeeNumber: 'NL-072', terminal: 'Pune depot', status: 'on_duty', vehicle: 'Truck 176', hoursLeft: '7:55', licenceExpires: '28 Feb 2032', licenceWarning: false, safetyScore: 85 },
  { id: 'd9', name: 'Vikram Chavan', initials: 'VC', employeeNumber: 'NL-083', terminal: 'Pune depot', status: 'driving', vehicle: 'Truck 191', hoursLeft: '5:15', licenceExpires: '11 Oct 2029', licenceWarning: false, safetyScore: 82 },
  { id: 'd10', name: 'Asha Patil', initials: 'AP', employeeNumber: 'NL-090', terminal: 'Nashik depot', status: 'on_duty', vehicle: 'Truck 145', hoursLeft: '8:30', licenceExpires: '03 Apr 2031', licenceWarning: false, safetyScore: 93 },
  { id: 'd11', name: 'Salim Ansari', initials: 'SA', employeeNumber: 'NL-095', terminal: 'Pune depot', status: 'resting', vehicle: 'Truck 168', hoursLeft: '10:00', licenceExpires: '22 Dec 2026', licenceWarning: true, safetyScore: 77 },
  { id: 'd12', name: 'Kiran Bhosale', initials: 'KB', employeeNumber: 'NL-101', terminal: 'Nashik depot', status: 'driving', vehicle: 'Truck 122', hoursLeft: '3:05', licenceExpires: '18 May 2030', licenceWarning: false, safetyScore: 89 },
  { id: 'd13', name: 'Pooja Gaikwad', initials: 'PG', employeeNumber: 'NL-108', terminal: 'Pune depot', status: 'off_duty', vehicle: null, hoursLeft: '11:00', licenceExpires: '07 Aug 2028', licenceWarning: false, safetyScore: 95 },
  { id: 'd14', name: 'Arjun Kadam', initials: 'AK', employeeNumber: 'NL-115', terminal: 'Pune depot', status: 'driving', vehicle: 'Truck 137', hoursLeft: '6:20', licenceExpires: '29 Jan 2032', licenceWarning: false, safetyScore: 74 },
  { id: 'd15', name: 'Rekha More', initials: 'RM', employeeNumber: 'NL-119', terminal: 'Nashik depot', status: 'on_duty', vehicle: 'Truck 152', hoursLeft: '7:40', licenceExpires: '14 Jun 2029', licenceWarning: false, safetyScore: 87 },
  { id: 'd16', name: 'Suresh Jadhav', initials: 'SJ', employeeNumber: 'NL-124', terminal: 'Pune depot', status: 'offline', vehicle: 'Truck 160', hoursLeft: '—', licenceExpires: '02 Feb 2027', licenceWarning: false, safetyScore: 66 },
  { id: 'd17', name: 'Fatima Sheikh', initials: 'FS', employeeNumber: 'NL-130', terminal: 'Nashik depot', status: 'driving', vehicle: 'Truck 174', hoursLeft: '4:55', licenceExpires: '25 Sep 2030', licenceWarning: false, safetyScore: 92 },
  { id: 'd18', name: 'Ganesh Shinde', initials: 'GS', employeeNumber: 'NL-136', terminal: 'Pune depot', status: 'resting', vehicle: 'Truck 183', hoursLeft: '9:45', licenceExpires: '16 Nov 2028', licenceWarning: false, safetyScore: 81 },
  { id: 'd19', name: 'Anita Salvi', initials: 'AS', employeeNumber: 'NL-142', terminal: 'Pune depot', status: 'on_duty', vehicle: 'Truck 198', hoursLeft: '6:00', licenceExpires: '09 Jul 2031', licenceWarning: false, safetyScore: 90 },
  { id: 'd20', name: 'Rahul Pednekar', initials: 'RP', employeeNumber: 'NL-147', terminal: 'Nashik depot', status: 'off_duty', vehicle: null, hoursLeft: '11:00', licenceExpires: '31 Mar 2029', licenceWarning: false, safetyScore: 84 },
  { id: 'd21', name: 'Deepa Naik', initials: 'DN', employeeNumber: 'NL-153', terminal: 'Pune depot', status: 'driving', vehicle: 'Truck 205', hoursLeft: '2:10', licenceExpires: '20 Oct 2026', licenceWarning: true, safetyScore: 78 },
  { id: 'd22', name: 'Yusuf Khan', initials: 'YK', employeeNumber: 'NL-158', terminal: 'Nashik depot', status: 'on_duty', vehicle: 'Truck 211', hoursLeft: '8:05', licenceExpires: '12 Dec 2030', licenceWarning: false, safetyScore: 86 },
  { id: 'd23', name: 'Snehal Kale', initials: 'SK', employeeNumber: 'NL-164', terminal: 'Pune depot', status: 'driving', vehicle: 'Truck 219', hoursLeft: '5:40', licenceExpires: '06 May 2032', licenceWarning: false, safetyScore: 97 },
  { id: 'd24', name: 'Mahesh Rane', initials: 'MR', employeeNumber: 'NL-170', terminal: 'Nashik depot', status: 'off_duty', vehicle: null, hoursLeft: '11:00', licenceExpires: '27 Feb 2028', licenceWarning: false, safetyScore: 73 },
]

export const DRIVER_STATUS_LABEL: Record<Driver['status'], string> = {
  driving: 'Driving',
  on_duty: 'On duty',
  resting: 'Resting',
  off_duty: 'Off duty',
  offline: 'Offline',
}

export const DRIVER_STATUS_TONE: Record<Driver['status'], Tone> = {
  driving: 'success',
  on_duty: 'accent',
  resting: 'warning',
  off_duty: 'neutral',
  offline: 'danger',
}
