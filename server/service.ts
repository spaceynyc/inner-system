import type { IncomingMessage, ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import { compositionSchema, PRESETS } from '../src/contracts/composition.ts'
import { getDatabase } from './database.ts'
import { CompositionRepository, RequestError } from './repository.ts'

const localKey = 'inner-system-local-development-only-signing-key'
const idPattern = /^[a-zA-Z0-9_-]{12,40}$/
type ApiRequest = IncomingMessage & { body?: unknown }
const escape = (s: string) => s.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)

async function body(req: ApiRequest): Promise<unknown> {
  if (Number(req.headers['content-length'] ?? 0) > 8192) throw new RequestError(413, 'Composition is too large.')
  if (req.body !== undefined) {
    const value = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    if (Buffer.byteLength(value) > 8192) throw new RequestError(413, 'Composition is too large.')
    try { return JSON.parse(value) } catch { throw new RequestError(400, 'Invalid JSON.') }
  }
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const bytes = Buffer.from(chunk)
    size += bytes.length
    if (size > 8192) throw new RequestError(413, 'Composition is too large.')
    chunks.push(bytes)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new RequestError(400, 'Invalid JSON.') }
}

export async function service(req: ApiRequest, res: ServerResponse, local = false) {
  const requestId = randomUUID()
  res.setHeader('X-Request-Id', requestId)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'same-origin')
  res.setHeader('Cache-Control', 'no-store')
  const json = (status: number, value: unknown) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(value)) }
  try {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const route = url.searchParams.get('route') ?? url.pathname.replace(/^\/api\/?/, '')
    const method = req.method ?? 'GET'
    if (route === 'presets' && method === 'GET') { res.setHeader('Cache-Control', 'public, max-age=3600'); json(200, { presets: PRESETS }); return }
    if (route === 'health' && method === 'GET') { json(200, { status: 'ok', sharingConfigured: Boolean(process.env.DATABASE_URL && process.env.SHARE_SIGNING_KEY) || local }); return }
    const signingKey = process.env.SHARE_SIGNING_KEY ?? (local && !process.env.VERCEL ? localKey : '')
    if (!signingKey) throw new RequestError(503, 'Shared storage is not configured. Portable links remain available.')
    const repo = new CompositionRepository(await getDatabase(local), signingKey)
    if (method === 'POST' || method === 'DELETE') {
      const origin = req.headers.origin
      const host = req.headers.host
      const allowed = process.env.APP_ORIGIN
      if (origin && origin !== allowed && new URL(origin).host !== host) throw new RequestError(403, 'This request origin is not allowed.')
      const identity = local ? req.socket.remoteAddress ?? 'local' : String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? 'unknown').split(',')[0].trim()
      await repo.allow(identity)
    }
    if (route === 'compositions' && method === 'POST') {
      if (!String(req.headers['content-type']).startsWith('application/json')) throw new RequestError(415, 'Send a JSON composition.')
      const parsed = compositionSchema.safeParse(await body(req))
      if (!parsed.success) throw new RequestError(400, 'The composition has invalid or unsupported settings.')
      const key = req.headers['idempotency-key']
      if (typeof key !== 'string' || !/^[a-zA-Z0-9_-]{20,80}$/.test(key)) throw new RequestError(400, 'A valid request key is required.')
      json(201, await repo.create(parsed.data, key)); return
    }
    const id = route.split('/')[1]
    if (route.startsWith('compositions/') && idPattern.test(id ?? '') && route.split('/').length === 2) {
      if (method === 'GET') { json(200, await repo.get(id)); return }
      if (method === 'DELETE') {
        const auth = req.headers.authorization ?? ''
        if (!auth.startsWith('Bearer ') || auth.length > 200) throw new RequestError(403, 'An ownership token is required.')
        await repo.revoke(id, auth.slice(7)); json(200, { revoked: true }); return
      }
    }
    const shareId = route.startsWith('/s/') ? route.slice(3) : route.startsWith('share/') ? route.slice(6) : ''
    if (shareId && idPattern.test(shareId) && method === 'GET') {
      const record = await repo.get(shareId)
      const title = escape(record.composition.name)
      const origin = process.env.APP_ORIGIN ?? (local ? `http://${req.headers.host}` : `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL ?? req.headers.host}`)
      const destination = `/?composition=${shareId}`
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — The Inner System</title><meta name="description" content="A composition in sound and light. Open this signal and make it your own."><meta property="og:title" content="${title} — The Inner System"><meta property="og:description" content="A small universe, made of sound and light."><meta property="og:type" content="website"><meta property="og:image" content="${escape(origin)}/social-card.jpg"><meta property="og:url" content="${escape(origin)}/s/${shareId}"><meta name="twitter:card" content="summary_large_image"><meta http-equiv="refresh" content="0;url=${destination}"></head><body style="background:#03040b;color:#e9ebf7;font-family:system-ui;padding:8vw"><h1>${title}</h1><p>A composition in sound and light.</p><a style="color:#a7b8ff" href="${destination}">Enter the signal →</a></body></html>`)
      return
    }
    if (route === 'cleanup' && method === 'GET') {
      if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) throw new RequestError(403, 'Not authorized.')
      await repo.cleanup(); json(200, { cleaned: true }); return
    }
    throw new RequestError(404, 'Route not found.')
  } catch (error) {
    const status = error instanceof RequestError ? error.status : 503
    if (status === 429) res.setHeader('Retry-After', '60')
    // No audio, filenames, configuration bodies, secrets or raw IPs in logs.
    if (!(error instanceof RequestError)) console.error(JSON.stringify({ event: 'share_service_unavailable', requestId }))
    json(status, { error: error instanceof RequestError ? error.message : 'The sharing service is temporarily unavailable.', requestId })
  }
}
