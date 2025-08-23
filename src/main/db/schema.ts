import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const files = sqliteTable('files', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  size: integer('size').notNull(),
  mimeType: text('mime_type'),
  etag: text('etag'),
  lastModified: integer('last_modified', { mode: 'timestamp' }),
  uploadedAt: integer('uploaded_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  bucket: text('bucket').notNull(),
  storageClass: text('storage_class'),
  contentEncoding: text('content_encoding'),
  contentDisposition: text('content_disposition'),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, string>>(),
})
