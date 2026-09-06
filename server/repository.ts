import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Composition } from '../src/contracts/composition.ts'
import type { Database } from './database.ts'

export class RequestError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
type Row = { id: string; config: Composition; delete_hash: string; idempotency_key: string; payload_hash: string; revoked_at: string | null; expires_at: string }
const hash = (value: string) => createHash('sha256').update(value).digest('hex')

export class CompositionRepository {
  constructor(private db: Database, private secret: string) {
    if (secret.length < 32) throw new Error('A signing key of at least 32 characters is required')
  }
  private token(id: string, key: string) { return createHmac('sha256', this.secret).update(`${id}:${key}`).digest('base64url') }
  async allow(identity: string) {
    const minute = Math.floor(Date.now() / 60_000)
    const bucket = createHmac('sha256', this.secret).update(`${identity}:${minute}`).digest('hex')
    const rows = await this.db.query<{ hits: number }>(
      `INSERT INTO request_limits(bucket, hits, expires_at) VALUES ($1, 1, NOW() + INTERVAL '2 minutes')
       ON CONFLICT(bucket) DO UPDATE SET hits = request_limits.hits + 1 RETURNING hits`, [bucket])
    if (rows[0].hits > 12) throw new RequestError(429, 'Too many changes. Try again in a minute.')
  }
  async create(config: Composition, key: string) {
    const digest = hash(JSON.stringify(config))
    const id = randomBytes(12).toString('base64url')
    const token = this.token(id, key)
    const inserted = await this.db.query<Row>(
      `INSERT INTO compositions(id, config, delete_hash, idempotency_key, payload_hash) VALUES ($1, $2::jsonb, $3, $4, $5)
       ON CONFLICT(idempotency_key) DO NOTHING RETURNING *`, [id, JSON.stringify(config), hash(token), key, digest])
    const row = inserted[0] ?? (await this.db.query<Row>('SELECT * FROM compositions WHERE idempotency_key = $1', [key]))[0]
    if (!row || row.payload_hash !== digest || row.revoked_at || Date.parse(row.expires_at) <= Date.now()) throw new RequestError(409, 'This request key has already been used.')
    return { id: row.id, deleteToken: this.token(row.id, key), expiresAt: row.expires_at }
  }
  async get(id: string) {
    const rows = await this.db.query<Row>('SELECT * FROM compositions WHERE id = $1 AND revoked_at IS NULL AND expires_at > NOW()', [id])
    if (!rows.length) throw new RequestError(404, 'This composition is no longer available.')
    return { id: rows[0].id, composition: rows[0].config, expiresAt: rows[0].expires_at }
  }
  async revoke(id: string, token: string) {
    const rows = await this.db.query<Row>('SELECT * FROM compositions WHERE id = $1', [id])
    const actual = Buffer.from(hash(token), 'hex')
    const expected = Buffer.from(rows[0]?.delete_hash ?? '0'.repeat(64), 'hex')
    if (!timingSafeEqual(actual, expected) || !rows.length) throw new RequestError(403, 'This link cannot be revoked from this session.')
    await this.db.query('UPDATE compositions SET revoked_at = COALESCE(revoked_at, NOW()) WHERE id = $1', [id])
  }
  async cleanup() {
    await this.db.query('DELETE FROM request_limits WHERE expires_at < NOW()')
    await this.db.query("DELETE FROM compositions WHERE expires_at < NOW() OR revoked_at < NOW() - INTERVAL '7 days'")
  }
}
