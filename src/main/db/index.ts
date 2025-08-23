import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { isDevelopment } from '@/main/constants'
import * as schema from '@/main/db/schema'

const client = createClient({
  url: process.env.DRIZZLE_DATABASE_URL,
})

export const db = drizzle(client, {
  logger: isDevelopment,
  schema,
})
