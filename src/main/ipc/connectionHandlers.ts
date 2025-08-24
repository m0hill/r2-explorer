import { ListBucketsCommand, S3Client } from '@aws-sdk/client-s3'
import { eq } from 'drizzle-orm'
import { Effect } from 'effect'
import { ipcMain, safeStorage } from 'electron'
import { db } from '@/main/db'
import { connections } from '@/main/db/schema'
import type { AddConnectionData } from '@/preload'
import { appState } from './state'

export function registerConnectionHandlers() {
  ipcMain.handle('connections:get', () =>
    Effect.tryPromise({
      try: () =>
        db
          .select({
            id: connections.id,
            name: connections.name,
            accountId: connections.accountId,
            accessKeyId: connections.accessKeyId,
          })
          .from(connections),
      catch: error => {
        console.error('Error fetching connections:', error)
        return new Error('Failed to fetch connections')
      },
    }).pipe(
      Effect.catchAll(() => Effect.succeed([])),
      Effect.runPromise
    )
  )

  ipcMain.handle('connections:add', (_, data: AddConnectionData) =>
    Effect.gen(function* () {
      if (!safeStorage.isEncryptionAvailable()) {
        yield* Effect.fail(new Error('Encryption not available'))
      }

      const secretAccessKeyEncrypted = safeStorage.encryptString(data.secretAccessKey)

      const result = yield* Effect.tryPromise(() =>
        db
          .insert(connections)
          .values({
            name: data.name,
            accountId: data.accountId,
            accessKeyId: data.accessKeyId,
            secretAccessKeyEncrypted,
          })
          .returning({ id: connections.id })
      )

      return result[0]!.id
    }).pipe(
      Effect.catchAll(error =>
        Effect.fail(
          new Error(
            `Failed to add connection: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        )
      ),
      Effect.runPromise
    )
  )

  ipcMain.handle('connections:delete', (_, id: number) =>
    Effect.tryPromise(() => db.delete(connections).where(eq(connections.id, id))).pipe(
      Effect.map(() => true),
      Effect.catchAll(error =>
        Effect.fail(
          new Error(
            `Failed to delete connection: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        )
      ),
      Effect.runPromise
    )
  )

  ipcMain.handle('r2:connect', (_, id: number) =>
    Effect.gen(function* () {
      const connectionResults = yield* Effect.tryPromise(() =>
        db.select().from(connections).where(eq(connections.id, id)).limit(1)
      )

      if (connectionResults.length === 0) {
        yield* Effect.fail(new Error('Connection not found'))
      }

      if (!safeStorage.isEncryptionAvailable()) {
        yield* Effect.fail(new Error('Encryption not available'))
      }

      const { accountId, accessKeyId, secretAccessKeyEncrypted } = connectionResults[0]!
      const secretAccessKey = safeStorage.decryptString(secretAccessKeyEncrypted as Buffer)

      const client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      })

      yield* Effect.tryPromise(() => client.send(new ListBucketsCommand({})))

      appState.s3Client = client
      return { success: true }
    }).pipe(
      Effect.catchAll(error => {
        appState.s3Client = null
        return Effect.succeed({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }),
      Effect.runPromise
    )
  )
}
