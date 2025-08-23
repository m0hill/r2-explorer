import { blob, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const connections = sqliteTable('connections', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  accountId: text('account_id').notNull(),
  accessKeyId: text('access_key_id').notNull(),
  secretAccessKeyEncrypted: blob('secret_access_key_encrypted').notNull(),
})

export type Connection = typeof connections.$inferSelect
export type NewConnection = typeof connections.$inferInsert
