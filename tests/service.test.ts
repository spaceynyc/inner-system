import { createServer, type Server } from 'node:http'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDatabase } from '../server/database'
import { service } from '../server/service'
import { PRESETS } from '../src/contracts/composition'

vi.mock('../server/database.ts', async () => {
  const { PGlite } = await import('@electric-sql/pglite')
  const { schema } = await import('../server/schema')
  const pg = new PGlite()
  const ready = pg.waitReady.then(() => pg.exec(schema))
  const db = {
    query: async (sql: string, params: unknown[] = []) => { await ready; return (await pg.query(sql, params)).rows },
    exec: async (sql: string) => { await ready; await pg.exec(sql) }, close: () => pg.close(),
  }
  return { getDatabase: async () => db }
})
let server: Server
let origin: string
beforeAll(async () => {
  server = createServer((req, res) => { void service(req, res, true) })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing test server')
  origin = `http://127.0.0.1:${address.port}`
})
beforeEach(async () => { await (await getDatabase(true)).exec('TRUNCATE compositions, request_limits') })
afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); await (await getDatabase(true)).close() })
const post = (body: string, headers: Record<string, string> = {}) => fetch(`${origin}/api/compositions`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID(), Origin: origin, ...headers }, body })

describe('HTTP composition service', () => {
  it('creates, resolves social metadata, reopens, and revokes a composition', async () => {
    const created = await post(JSON.stringify(PRESETS[1]))
    expect(created.status).toBe(201)
    const item = await created.json() as { id: string; deleteToken: string }
    const page = await fetch(`${origin}/s/${item.id}`)
    expect(page.headers.get('content-type')).toContain('text/html')
    expect(await page.text()).toContain(`/?composition=${item.id}`)
    const opened = await fetch(`${origin}/api/compositions/${item.id}`)
    expect((await opened.json()).composition).toEqual(PRESETS[1])
    const removed = await fetch(`${origin}/api/compositions/${item.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${item.deleteToken}`, Origin: origin } })
    expect(removed.status).toBe(200)
    expect((await fetch(`${origin}/api/compositions/${item.id}`)).status).toBe(404)
  })
  it('rejects malformed JSON, unsupported contracts, and oversized payloads', async () => {
    expect((await post('{')).status).toBe(400)
    expect((await post(JSON.stringify({ ...PRESETS[0], version: 2 }))).status).toBe(400)
    expect((await post(JSON.stringify({ ...PRESETS[0], name: 'a'.repeat(9000) }))).status).toBe(413)
  })
  it('requires JSON and an allowed request origin', async () => {
    expect((await post(JSON.stringify(PRESETS[0]), { 'Content-Type': 'text/plain' })).status).toBe(415)
    expect((await post(JSON.stringify(PRESETS[0]), { Origin: 'https://unrelated.example' })).status).toBe(403)
  })
  it('returns presets and bounded rate-limit errors', async () => {
    expect((await (await fetch(`${origin}/api/presets`)).json()).presets).toEqual(PRESETS)
    for (let i = 0; i < 12; i++) await post(JSON.stringify(PRESETS[0]))
    const limited = await post(JSON.stringify(PRESETS[0]))
    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).toBe('60')
  })
})
