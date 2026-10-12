import assert from 'node:assert/strict'
import test from 'node:test'
import { createHandler, newProjectPayload } from '../supabase/functions/monteur-api/handler.mjs'

const actor = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Jonathan' }
const input = { requestId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', projekt: 'Haustür', kunde: 'Musterkunde', ort: 'Ehingen' }
test('personal identity and starting status cannot be supplied by the browser', () => {
  const row = newProjectPayload({ ...input, created_by: 'other', created_by_name: 'Samuel', status: 'ERLEDIGT', attachment_url: 'https://wrong.example', created_at: '2020-01-01' }, actor)
  assert.equal(row.created_by, actor.id); assert.equal(row.created_by_name, 'Jonathan'); assert.equal(row.status, 'AUFMASS')
  assert.equal(row.lead, 'Jonathan'); assert.equal(row.created_at, undefined); assert.equal(row.attachment_url, undefined)
  assert.equal(row.client_request_id, input.requestId)
})
test('invalid mobile submissions are rejected before storing any project', () => {
  for (const patch of [{ projekt: ' ' }, { kunde: '' }, { ort: '' }, { requestId: 'wrong' }, { termin: '2026-02-30' }, { uhrzeit: '09:00' }, { team: ['Unknown'] }, { notiz: 'x'.repeat(4001) }]) {
    assert.throws(() => newProjectPayload({ ...input, ...patch }, actor))
  }
})
test('missing credentials are rejected without touching the database', async () => {
  let queried = false
  const handler = createHandler({ from: () => { queried = true; throw new Error('unexpected') } })
  const result = await handler(new Request('https://example.test', { method: 'POST', body: JSON.stringify({ action: 'list' }) }))
  assert.equal(result.status, 401); assert.equal(queried, false)
})
test('unknown or disabled personal links cannot read projects', async () => {
  const queries = []
  const query = { select: () => query, eq: (...args) => { queries.push(args); return query }, maybeSingle: async () => ({ data: null, error: null }) }
  const handler = createHandler({ from: table => { assert.equal(table, 'monteur_access'); return query } })
  const result = await handler(new Request('https://example.test', { method: 'POST', headers: { 'x-monteur-token': 'A'.repeat(43) }, body: JSON.stringify({ action: 'list' }) }))
  assert.equal(result.status, 401); assert.deepEqual(queries[1], ['active', true]); assert.match(queries[0][1], /^[0-9a-f]{64}$/)
})

test('metadata edits are restricted and attributed, while creator, comments and status stay untouched', async () => {
  const { editProjectPayload } = await import('../supabase/functions/monteur-api/handler.mjs')
  const current = { ...newProjectPayload(input, actor), details_version: 2, notiz: 'Vorhandener Kommentar' }
  const patch = editProjectPayload({ version: 2, changes: { telefon: ' 01234 56789 ', termin: '2026-10-20', uhrzeit: '09:30', mitarbeiter: 'Ruben, Edmund' } }, current, actor)
  assert.deepEqual(patch, { telefon: '01234 56789', termin: '2026-10-20', uhrzeit: '09:30', mitarbeiter: 'Ruben, Edmund', details_updated_by: actor.name })
  for (const field of ['notiz', 'status', 'created_by', 'created_by_name', 'details_updated_by', 'details_version', '__proto__']) {
    assert.throws(() => editProjectPayload({ version: 2, changes: { [field]: 'wrong' } }, current, actor))
  }
  for (const changes of [{ termin: '2026-02-30' }, { uhrzeit: '24:00' }, { mitarbeiter: 'Unknown' }, { email_kunde: 'no-email' }, { projekt: '' }]) {
    assert.throws(() => editProjectPayload({ version: 2, changes }, current, actor))
  }
  assert.throws(() => editProjectPayload({ changes: { telefon: '123' } }, current, actor))
  assert.throws(() => editProjectPayload({ version: 2, changes: {} }, current, actor))
})
