import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createPlannerClient } from '../src/plannerClient.mjs'
import { plannerProjects } from '../supabase/functions/gnannt-calculator/planner-projects.mjs'

test('planner client sends the authenticated session, text and project only', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://example.test/api')
    assert.equal(options.headers['x-planer-session'], 'test-session')
    assert.deepEqual(JSON.parse(options.body), { action: 'planner-projects', op: 'comment', id: 7, comment: 'Rückmeldung' })
    return Response.json({ data: { id: 7, notiz: 'server result' }, error: null })
  })
  const client = createPlannerClient('test-session', 'https://example.test/api')
  assert.deepEqual(await client.appendComment(7, ' Rückmeldung ', 'Samuel'), { id: 7, notiz: 'server result' })
})

test('invalid comments never leave the client', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw Error('unexpected request') })
  const client = createPlannerClient('test-session')
  for (const [id, text] of [[0, 'hello'], [1, ' '], [1, null], [1, 'x'.repeat(2001)]]) {
    await assert.rejects(client.appendComment(id, text))
  }
  assert.equal(fetch.mock.callCount(), 0)
})

test('expired sessions, database failures and missing projects are not reported as saved', async t => {
  const client = createPlannerClient('test-session')
  for (const [status, body, expected] of [[401, { error: 'Planer-Sitzung abgelaufen. Bitte erneut anmelden.' }, /erneut anmelden/], [200, { error: { message: 'database failure' } }, /database failure/], [200, { data: null, error: null }, /Auftrag nicht gefunden/]]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(body, { status }))
    await assert.rejects(client.appendComment(7, 'Text'), expected)
    t.mock.restoreAll()
  }
})

test('backend comment path ignores supplied identity and history; only the fixed-author RPC is used', async () => {
  const calls = []
  const project = { id: 7, notiz: 'existing\n\n[server timestamp · Planer]\nText' }
  const db = { rpc(name, args) { calls.push([name, args]); return { maybeSingle: async () => ({ data: project, error: null }) } }, from() { throw Error('Must not replace project notes directly') } }
  const result = await plannerProjects(db, { op: 'comment', id: 7, comment: ' Text ', author: 'Samuel', created_by_name: 'Ruben', values: { notiz: 'overwrite history' } })
  assert.equal(result.data, project)
  assert.deepEqual(calls, [['planner_append_comment', { p_project_id: 7, p_comment: 'Text' }]])
})

test('backend rejects invalid comment payloads before touching the database', async () => {
  const db = { rpc() { throw Error('unexpected RPC') } }
  for (const input of [{ id: '7', comment: 'Text' }, { id: -1, comment: 'Text' }, { id: 7, comment: null }, { id: 7, comment: ' ' }, { id: 7, comment: 'x'.repeat(2001) }]) {
    await assert.rejects(plannerProjects(db, { op: 'comment', ...input }), /Projekt-ID|Kommentar prüfen/)
  }
})

test('planner uses fixed login author without silently filtering the list to a non-employee', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /fixedAuthor=\{plannerSession \? 'Planer' : undefined\} personalName=""/)
  assert.match(app, /plannerSession\s*\? await projectClient.appendComment\(id, text\)/)
})

test('atomic RPC is invoker-only and not exposed to browser roles', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261030113207_planner_comments_from_login.sql', import.meta.url), 'utf8')
  assert.match(sql, /security invoker set search_path = ''/)
  assert.match(sql, /revoke all on function public.planner_append_comment\(bigint, text\) from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public.planner_append_comment\(bigint, text\) to service_role/)
  assert.doesNotMatch(sql, /security definer/i)
})
