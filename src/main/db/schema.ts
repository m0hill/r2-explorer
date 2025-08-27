import { sql } from 'drizzle-orm'
import { blob, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const connections = sqliteTable('connections', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  accountId: text('account_id').notNull(),
  accessKeyId: text('access_key_id').notNull(),
  secretAccessKeyEncrypted: blob('secret_access_key_encrypted').notNull(),
  // Optional Cloudflare API token to provision Worker via IaC
  apiTokenEncrypted: blob('api_token_encrypted'),
  // Cached worker identity for links; can be rederived but this avoids repeated lookups
  workerName: text('worker_name'),
  workerSubdomain: text('worker_subdomain'),
})

export const presignedUrls = sqliteTable('presigned_urls', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  objectKey: text('object_key').notNull(),
  bucketName: text('bucket_name').notNull(),
  url: text('url').notNull(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const folderShares = sqliteTable('folder_shares', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  connectionId: integer('connection_id').notNull(),
  shareId: text('share_id').notNull(),
  bucketName: text('bucket_name').notNull(),
  prefix: text('prefix').notNull(),
  url: text('url').notNull(),
  expiresAt: text('expires_at').notNull(),
  // Use 0/1 under the hood; typed as boolean in TS
  hasPin: integer('has_pin', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export type Connection = typeof connections.$inferSelect
export type NewConnection = typeof connections.$inferInsert

export type PresignedUrl = typeof presignedUrls.$inferSelect
export type NewPresignedUrl = typeof presignedUrls.$inferInsert

export type FolderShare = typeof folderShares.$inferSelect
export type NewFolderShare = typeof folderShares.$inferInsert
