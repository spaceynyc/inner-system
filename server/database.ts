import { schema } from './schema.ts'
import { mkdir } from 'node:fs/promises'

export interface Database {
  query<T>(sql: string, parameters?: unknown[]): Promise<T[]>
  exec(sql: string): Promise<void>
  close(): Promise<void>
}

let connection: Promise<Database> | null = null

export function getDatabase(local = false): Promise<Database> {
  if (!connection) connection = connect(local).catch((error) => { connection = null; throw error })
  return connection
}

async function connect(local: boolean): Promise<Database> {
  const url = process.env.DATABASE_URL
  if (url) {
    const { default: postgres } = await import('postgres')
    const sql = postgres(url, { max: 3, idle_timeout: 20, connect_timeout: 10, prepare: false })
    return {
      query: async <T>(text: string, parameters: unknown[] = []) => await sql.unsafe(text, parameters as never[]) as unknown as T[],
      exec: async (text) => { await sql.unsafe(text) },
      close: async () => { await sql.end() },
    }
  }
  if (!local || process.env.VERCEL) throw new Error('Shared storage is not configured')
  const { PGlite } = await import('@electric-sql/pglite')
  await mkdir('.data', { recursive: true })
  const db = new PGlite('.data/postgres')
  await db.waitReady
  await db.exec(schema)
  return {
    query: async <T>(text: string, parameters: unknown[] = []) => (await db.query<T>(text, parameters)).rows,
    exec: async (text) => { await db.exec(text) },
    close: () => db.close(),
  }
}
