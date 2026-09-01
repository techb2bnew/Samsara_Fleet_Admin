import type { Driver, StaffUser } from '../mocks/people'
import type { Vehicle } from '../mocks/vehicles'

export function hrefForDriverName(drivers: Driver[], name: string | null | undefined) {
  if (!name) return '/drivers'
  const driver = drivers.find((d) => d.name === name)
  return driver ? `/drivers/${driver.id}` : '/drivers'
}

export function hrefForPerson(
  drivers: Driver[],
  staff: StaffUser[],
  name: string | null | undefined,
) {
  if (!name) return '/drivers'
  const driver = drivers.find((d) => d.name === name)
  if (driver) return `/drivers/${driver.id}`
  const user = staff.find((u) => u.name === name)
  if (user) return `/users/${user.id}`
  return '/drivers'
}

export function hrefForVehicleName(vehicles: Vehicle[], name: string | null | undefined) {
  if (!name) return '/vehicles'
  const vehicle = vehicles.find((v) => v.name === name)
  return vehicle ? `/vehicles/${vehicle.id}` : '/vehicles'
}

export function hrefForDriverThread(name: string | null | undefined) {
  if (!name) return '/messages'
  return `/messages?driver=${encodeURIComponent(name)}`
}

export function hrefForVehicleOnMap(name: string | null | undefined) {
  if (!name) return '/map'
  return `/map?vehicle=${encodeURIComponent(name)}`
}
