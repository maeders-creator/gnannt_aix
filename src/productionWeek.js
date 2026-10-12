import { berlinDay, compareProjectUrgency } from './projectTodos.js'

export function currentProductionWeek(now = new Date()) {
  const today = berlinDay(now)
  // Date-only arithmetic in UTC avoids DST and device-timezone shifts.
  const monday = new Date(`${today}T12:00:00Z`)
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7)
  const sunday = new Date(monday)
  sunday.setUTCDate(sunday.getUTCDate() + 6)
  const thursday = new Date(monday)
  thursday.setUTCDate(thursday.getUTCDate() + 3)
  const first = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1, 12))
  const number = Math.ceil(((thursday - first) / 86400000 + 1) / 7)
  return { today, start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10), number }
}

export function productionWeekItems(items, week) {
  return items.filter(item => item.status !== 'ERLEDIGT' && item.termin && item.termin >= week.start && item.termin <= week.end).sort(compareProjectUrgency)
}

export function screenDate(value, weekday = false) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString('de-DE', {
    timeZone: 'UTC', ...(weekday ? { weekday: 'long' } : {}), day: '2-digit', month: '2-digit',
  })
}
