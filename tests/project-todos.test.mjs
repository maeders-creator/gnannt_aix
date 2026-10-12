import test from 'node:test'
import assert from 'node:assert/strict'
import { berlinDay, projectTodoList, appendProjectComment, completeProject } from '../src/projectTodos.js'

const fixture = [
  { id: 1, projekt: 'Alter Auftrag', status: 'IN_ARBEIT', created_at: '2026-09-01', termin: null, lead: 'Edmund', mitarbeiter: 'Ruben, Jonathan' },
  { id: 2, projekt: 'Neuer Auftrag', status: 'AUFMASS', created_at: '2026-10-12', termin: null, lead: 'Samuel' },
  { id: 3, projekt: 'Erledigt', status: 'ERLEDIGT', created_at: '2026-10-12', termin: '2026-10-12' },
  { id: 4, projekt: 'Montage', status: 'MONTAGE', created_at: '2026-10-02', termin: '2026-10-12', lead: 'Ruben' },
  { id: 5, projekt: 'Überfällig', status: 'PRODUKTION', created_at: '2026-10-01', termin: '2026-10-09' },
]
test('all open projects remain visible including unknown status and no date; newest first', () => {
  assert.deepEqual(projectTodoList(fixture).map(p => p.id), [2, 4, 5, 1])
  assert.deepEqual(projectTodoList([...fixture, { id: 6, created_at: '2026-10-13', status: 'NEU' }]).map(p => p.id), [6, 2, 4, 5, 1])
})
test('team membership includes assistants; filters keep undated and completed projects reachable', () => {
  const opts = { today: '2026-10-12' }
  assert.deepEqual(projectTodoList(fixture, { ...opts, team: 'Ruben' }).map(p => p.id), [4, 1])
  assert.deepEqual(projectTodoList(fixture, { ...opts, filter: 'undated' }).map(p => p.id), [2, 1])
  assert.deepEqual(projectTodoList(fixture, { ...opts, filter: 'done' }).map(p => p.id), [3])
  assert.deepEqual(projectTodoList(fixture, { ...opts, filter: 'overdue' }).map(p => p.id), [5])
  assert.deepEqual(projectTodoList(fixture, { ...opts, filter: 'today' }).map(p => p.id), [4])
  assert.deepEqual(projectTodoList(fixture, { ...opts, filter: 'week' }).map(p => p.id), [4])
  assert.equal(berlinDay(new Date('2026-10-11T23:30:00Z')), '2026-10-12')
})

function fakeClient(initial, beforeWrite = () => {}) {
  let row = { ...initial }
  let writes = 0
  return {
    get row() { return row },
    from(table) {
      assert.equal(table, 'projects')
      return {
        select: () => ({ eq: () => ({ single: async () => ({ data: { ...row }, error: null }) }) }),
        update: patch => {
          const conditions = []
          const builder = {
            eq: (key, value) => { conditions.push([key, value]); return builder },
            is: (key, value) => { conditions.push([key, value]); return builder },
            select: () => ({ maybeSingle: async () => {
              row = beforeWrite({ ...row }, ++writes) || row
              if (!conditions.every(([key, value]) => row[key] === value)) return { data: null, error: null }
              row = { ...row, ...patch }
              return { data: { ...row }, error: null }
            } }),
          }
          return builder
        },
      }
    },
  }
}
test('concurrent comments are preserved and each comment appended exactly once', async () => {
  const client = fakeClient({ id: 1, notiz: 'Bisherige Notiz' }, (row, count) => count === 1 ? { ...row, notiz: `${row.notiz}\nKommentar vom anderen Gerät` } : row)
  const result = await appendProjectComment(client, 1, 'Material fehlt', 'Ruben', new Date('2026-10-12T12:00Z'))
  assert.match(result.notiz, /Bisherige Notiz/)
  assert.match(result.notiz, /Kommentar vom anderen Gerät/)
  assert.match(result.notiz, /Ruben/)
  assert.equal(result.notiz.split('Material fehlt').length, 2)
})
test('null notes work and persistent conflicts produce an actionable error', async () => {
  const client = fakeClient({ id: 1, notiz: null })
  assert.match((await appendProjectComment(client, 1, 'Fertig', 'Jonathan')).notiz, /Fertig/)
  const conflict = fakeClient({ id: 1, notiz: null }, (row, count) => ({ ...row, notiz: `Concurrent ${count}` }))
  await assert.rejects(appendProjectComment(conflict, 1, 'Entwurf', 'Jonathan'), /erneut speichern/)
})
test('completion changes only status, can be undone, and rejects stale status', async () => {
  const project = { id: 1, status: 'IN_ARBEIT', notiz: 'Erhalten' }
  const client = fakeClient(project)
  const done = await completeProject(client, project)
  assert.equal(done.status, 'ERLEDIGT'); assert.equal(done.notiz, 'Erhalten')
  assert.equal((await completeProject(client, done, project.status)).status, 'IN_ARBEIT')
  await assert.rejects(completeProject(client, { ...project, status: 'MONTAGE' }), /inzwischen geändert/)
})
