import { getDatabase } from './database.ts'
import { schema } from './schema.ts'
const db = await getDatabase(false)
try { await db.exec(schema); console.log('Schema migration complete.') } finally { await db.close() }
