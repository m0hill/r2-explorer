import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import path from 'path'
import { isDevelopment } from '@/main/constants'
import * as schema from '@/main/db/schema'

const dbPath = path.join(process.cwd(), 'dev.db')

const sqlite = new Database(dbPath)

export const db = drizzle(sqlite, {
  logger: isDevelopment,
  schema,
})
