import test from 'node:test'
import assert from 'node:assert/strict'
import { currentProductionWeek, productionWeekItems } from '../src/productionWeek.js'

test('screen shows the whole current Monday–Sunday week, including earlier days, but no other weeks or undated/done work', () => {
  const week = currentProductionWeek(new Date('2026-10-15T12:00:00Z'))
  assert.deepEqual(week, { today: '2026-10-15', start: '2026-10-12', end: '2026-10-18', number: 42 })
  const rows = [
    { id: 1, termin: '2026-10-18', status: 'MONTAGE' },
    { id: 2, termin: '2026-10-12', uhrzeit: '10:00', status: 'IN_ARBEIT' },
    { id: 3, termin: '2026-10-12', uhrzeit: '08:00', status: 'AUFMASS' },
    { id: 4, termin: '2026-10-11' }, { id: 5, termin: '2026-10-19' },
    { id: 6, termin: null }, { id: 7, termin: '2026-10-15', status: 'ERLEDIGT' },
  ]
  assert.deepEqual(productionWeekItems(rows, week).map(row => row.id), [3, 2, 1])
  assert.equal(rows[0].id, 1, 'sorting does not mutate source data')
})

test('week switches at Berlin midnight, not UTC or the screen device timezone', () => {
  assert.equal(currentProductionWeek(new Date('2026-10-18T21:59:59Z')).start, '2026-10-12')
  assert.equal(currentProductionWeek(new Date('2026-10-18T22:00:00Z')).start, '2026-10-19')
  // DST ends on 25 October; the next Monday starts at 23:00 UTC.
  assert.equal(currentProductionWeek(new Date('2026-10-25T22:59:59Z')).start, '2026-10-19')
  assert.equal(currentProductionWeek(new Date('2026-10-25T23:00:00Z')).start, '2026-10-26')
})

test('ISO week number and range remain correct across New Year', () => {
  assert.deepEqual(currentProductionWeek(new Date('2027-01-01T12:00:00Z')), {
    today: '2027-01-01', start: '2026-12-28', end: '2027-01-03', number: 53,
  })
  assert.equal(currentProductionWeek(new Date('2027-01-04T12:00:00Z')).number, 1)
})
