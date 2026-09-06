import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { randomUUID } from 'node:crypto'
import { CompositionRepository } from '../server/repository'
import { schema } from '../server/schema'
import type { Database } from '../server/database'
import { PRESETS } from '../src/contracts/composition'

const pg = new PGlite()
const db: Database = {
  query: async <T>(sql: string, params: unknown[] = []) => (await pg.query<T>(sql, params)).rows,
  exec: async (sql) => { await pg.exec(sql) }, close: () => pg.close(),
}
const repo = new CompositionRepository(db, 'test-only-signing-key-with-at-least-32-characters')

beforeAll(async () => { await pg.waitReady; await pg.exec(schema) })
beforeEach(async () => { await pg.exec('TRUNCATE compositions, request_limits') })
afterAll(() => pg.close())

describe('persistent composition lifecycle on PostgreSQL', () => {
  it('stores and reopens a complete composition', async () => {
    const result = await repo.create(PRESETS[0], randomUUID())
    const reopened = await repo.get(result.id)
    expect(reopened.composition).toEqual(PRESETS[0])
    expect(result.id).toMatch(/^[\w-]{16}$/)
    expect(result.deleteToken.length).toBeGreaterThan(32)
  })
  it('makes duplicate submissions idempotent with the same ownership token', async () => {
    const key = randomUUID()
    const first = await repo.create(PRESETS[0], key)
    const second = await repo.create(PRESETS[0], key)
    expect(first.id).toBe(second.id)
    expect(first.deleteToken).toBe(second.deleteToken)
    expect((await db.query<{ total: number }>('SELECT COUNT(*)::int AS total FROM compositions'))[0].total).toBe(1)
  })
  it('rejects a reused key for different data', async () => {
    const key = randomUUID()
    await repo.create(PRESETS[0], key)
    await expect(repo.create(PRESETS[1], key)).rejects.toMatchObject({ status: 409 })
  })
  it('allows revocation only by the owner and makes it idempotent', async () => {
    const item = await repo.create(PRESETS[0], randomUUID())
    await expect(repo.revoke(item.id, 'not-the-owner')).rejects.toMatchObject({ status: 403 })
    expect((await repo.get(item.id)).composition).toEqual(PRESETS[0])
    await repo.revoke(item.id, item.deleteToken)
    await repo.revoke(item.id, item.deleteToken)
    await expect(repo.get(item.id)).rejects.toMatchObject({ status: 404 })
  })
  it('does not expose expired compositions and removes expired data', async () => {
    const item = await repo.create(PRESETS[0], randomUUID())
    await db.query("UPDATE compositions SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1", [item.id])
    await expect(repo.get(item.id)).rejects.toMatchObject({ status: 404 })
    await repo.cleanup()
    expect(await db.query('SELECT id FROM compositions')).toEqual([])
  })
  it('enforces a shared write rate limit without persisting raw identity', async () => {
    for (let i = 0; i < 12; i++) await repo.allow('local-test-identity')
    await expect(repo.allow('local-test-identity')).rejects.toMatchObject({ status: 429 })
    const rows = await db.query<{ bucket: string }>('SELECT bucket FROM request_limits')
    expect(rows[0].bucket).not.toContain('local-test-identity')
  })
  it('stores only a hash of the revoke token', async () => {
    const item = await repo.create(PRESETS[0], randomUUID())
    const rows = await db.query<{ delete_hash: string }>('SELECT delete_hash FROM compositions WHERE id = $1', [item.id])
    expect(rows[0].delete_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(rows[0].delete_hash).not.toBe(item.deleteToken)
  })
})
