import { describe, expect, it } from 'vitest'
import {
  cumulativeKm,
  formatKm,
  parsePath,
  sampleAlongPath,
  serializePath,
} from '../src/features/dispatch/geometry'
import { parseLatLng } from '../src/features/dispatch/planAlongRoute'

/** A straight 111-ish km run due north, 1° of latitude. */
const north = [
  { lat: 18, lng: 73.8 },
  { lat: 19, lng: 73.8 },
]

describe('sampleAlongPath', () => {
  it('puts two stops on the ends', () => {
    const stops = sampleAlongPath(north, 2)
    expect(stops).toHaveLength(2)
    expect(stops[0].lat).toBeCloseTo(18)
    expect(stops[1].lat).toBeCloseTo(19)
    expect(stops[0].km).toBe(0)
    expect(stops[1].km).toBeGreaterThan(100)
  })

  it('spaces extra stops evenly by kilometres, not by point index', () => {
    const bent = [
      { lat: 18, lng: 73.8 },
      { lat: 18.1, lng: 73.8 },
      { lat: 19, lng: 73.8 },
    ]
    const stops = sampleAlongPath(bent, 3)
    expect(stops).toHaveLength(3)
    const mid = stops[1].km
    const end = stops[2].km
    expect(mid / end).toBeCloseTo(0.5, 1)
  })

  it('never returns fewer than start and end', () => {
    expect(sampleAlongPath(north, 1)).toHaveLength(2)
  })
})

describe('path round-trip', () => {
  it('serialises points the map can parse back', () => {
    const encoded = serializePath(north)
    expect(parsePath(encoded)).toEqual([
      { lat: 18, lng: 73.8 },
      { lat: 19, lng: 73.8 },
    ])
  })

  it('treats a missing polyline as nowhere to draw', () => {
    expect(parsePath(null)).toEqual([])
    expect(parsePath('')).toEqual([])
  })
})

describe('formatKm', () => {
  it('keeps short hops precise and rounds the rest', () => {
    expect(formatKm(0)).toBe('0 km')
    expect(formatKm(4.2)).toBe('4.2 km')
    expect(formatKm(50.4)).toBe('50 km')
  })
})

describe('parseLatLng', () => {
  it('reads a coordinate pair', () => {
    expect(parseLatLng('18.5089, 73.9260')).toEqual({ lat: 18.5089, lng: 73.926 })
  })

  it('rejects an address', () => {
    expect(parseLatLng('Hadapsar, Pune')).toBeNull()
  })
})
