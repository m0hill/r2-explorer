import { eq } from 'drizzle-orm'
import { Effect } from 'effect'
import { ipcMain } from 'electron'
import { ensureWorkerForConnection } from '@/main/cloudflare/ensureWorker'
import { db } from '@/main/db'
import { folderShares } from '@/main/db/schema'
import { appState } from './state'

export function registerWorkerHandlers() {
  ipcMain.handle('worker:ensure', () =>
    Effect.gen(function* () {
      const id = appState.currentConnectionId
      if (!id) {
        yield* Effect.fail(new Error('No active connection'))
      }
      const ensured = yield* ensureWorkerForConnection(id!)
      return ensured
    }).pipe(
      Effect.catchAll(error =>
        Effect.fail(
          new Error(
            `Failed to ensure worker: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        )
      ),
      Effect.runPromise
    )
  )

  ipcMain.handle(
    'folder-share:create',
    (_, params: { bucketName: string; prefix: string; expiresIn: number; pin?: string }) =>
      Effect.gen(function* () {
        const id = appState.currentConnectionId
        if (!id) {
          yield* Effect.fail(new Error('No active connection'))
        }

        const ensured = yield* ensureWorkerForConnection(id!)
        const token = (ensured as { adminToken: string }).adminToken
        if (!token) {
          yield* Effect.fail(new Error('Failed to compute admin token'))
        }
        const url = `${ensured.workerUrl}/admin/shares`
        const resp = yield* Effect.tryPromise({
          try: () =>
            (globalThis.fetch as typeof fetch)(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Admin-Token': token,
              },
              body: JSON.stringify({
                bucket: params.bucketName,
                prefix: params.prefix.endsWith('/') ? params.prefix : `${params.prefix}/`,
                expiresInSec: params.expiresIn,
                pin: params.pin && params.pin.trim().length > 0 ? params.pin : undefined,
              }),
            }),
          catch: e =>
            new Error(
              `Network error calling Worker admin/shares: ${
                e instanceof Error ? e.message : String(e)
              }`
            ),
        })
        if (!resp.ok) {
          const text = yield* Effect.tryPromise(() => resp.text())
          yield* Effect.fail(new Error(`Worker share failed: ${resp.status} ${text}`))
        }
        const data = (yield* Effect.tryPromise({
          try: () => resp.json(),
          catch: e =>
            new Error(
              `Failed to parse Worker response JSON: ${e instanceof Error ? e.message : String(e)}`
            ),
        })) as {
          id: string
          url: string
          expiresAt: string
        }

        // Persist in local DB
        yield* Effect.tryPromise(() =>
          db.insert(folderShares).values({
            connectionId: id!,
            shareId: data.id,
            bucketName: params.bucketName,
            prefix: params.prefix.endsWith('/') ? params.prefix : `${params.prefix}/`,
            url: data.url,
            expiresAt: data.expiresAt,
            hasPin: !!(params.pin && params.pin.trim().length > 0),
          })
        )

        return data
      }).pipe(
        Effect.catchAll(error =>
          Effect.fail(
            new Error(
              `Failed to create folder share: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`
            )
          )
        ),
        Effect.runPromise
      )
  )

  ipcMain.handle('folder-share:list', () =>
    Effect.gen(function* () {
      const connectionId = appState.currentConnectionId
      if (!connectionId) {
        yield* Effect.fail(new Error('No active connection'))
      }

      const validConnectionId = connectionId as number
      const rows = yield* Effect.tryPromise(() =>
        db.select().from(folderShares).where(eq(folderShares.connectionId, validConnectionId))
      )

      // prune expired
      const now = new Date()
      const expired = rows.filter(r => new Date(r.expiresAt) <= now)
      if (expired.length > 0) {
        yield* Effect.all(
          expired.map(r =>
            Effect.tryPromise(() => db.delete(folderShares).where(eq(folderShares.id, r.id!)))
          ),
          { concurrency: 5 }
        )
      }

      const active = rows.filter(r => new Date(r.expiresAt) > now)
      return active
    }).pipe(
      Effect.catchAll(error =>
        Effect.fail(
          new Error(
            `Failed to list folder shares: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`
          )
        )
      ),
      Effect.runPromise
    )
  )

  ipcMain.handle('folder-share:revoke', (_, params: { id: number }) =>
    Effect.gen(function* () {
      const connectionId = appState.currentConnectionId
      if (!connectionId) {
        yield* Effect.fail(new Error('No active connection'))
      }

      const rows = yield* Effect.tryPromise(() =>
        db.select().from(folderShares).where(eq(folderShares.id, params.id)).limit(1)
      )
      if (!rows.length) {
        yield* Effect.fail(new Error('Share not found'))
      }
      const row = rows[0]!
      if (row.connectionId !== connectionId) {
        yield* Effect.fail(new Error('Share belongs to a different connection'))
      }

      const ensured = yield* ensureWorkerForConnection(connectionId as number)
      const token = (ensured as { adminToken: string }).adminToken
      const delUrl = `${ensured.workerUrl}/admin/shares/${encodeURIComponent(row.shareId)}`

      // Best-effort revoke on Worker; 2xx/404/410 all OK
      const resp = yield* Effect.tryPromise({
        try: () =>
          (globalThis.fetch as typeof fetch)(delUrl, {
            method: 'DELETE',
            headers: { 'X-Admin-Token': token },
          }),
        catch: e =>
          new Error(
            `Network error calling Worker revoke: ${e instanceof Error ? e.message : String(e)}`
          ),
      })
      if (!resp.ok && resp.status !== 404 && resp.status !== 410) {
        const t = yield* Effect.tryPromise(() => resp.text())
        yield* Effect.fail(new Error(`Worker revoke failed: ${resp.status} ${t}`))
      }

      // Remove from local DB
      yield* Effect.tryPromise(() => db.delete(folderShares).where(eq(folderShares.id, row.id!)))
      return { success: true }
    }).pipe(
      Effect.catchAll(error =>
        Effect.fail(
          new Error(
            `Failed to revoke folder share: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`
          )
        )
      ),
      Effect.runPromise
    )
  )
}
