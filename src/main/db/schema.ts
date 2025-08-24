import { sql } from 'drizzle-orm'
import { blob, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const connections = sqliteTable('connections', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  accountId: text('account_id').notNull(),
  accessKeyId: text('access_key_id').notNull(),
  secretAccessKeyEncrypted: blob('secret_access_key_encrypted').notNull(),
})

export const presignedUrls = sqliteTable('presigned_urls', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  objectKey: text('object_key').notNull(),
  bucketName: text('bucket_name').notNull(),
  url: text('url').notNull(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export type Connection = typeof connections.$inferSelect
export type NewConnection = typeof connections.$inferInsert

export type PresignedUrl = typeof presignedUrls.$inferSelect
export type NewPresignedUrl = typeof presignedUrls.$inferInsert
