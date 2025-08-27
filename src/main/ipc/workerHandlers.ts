import { Effect } from 'effect'
import { ipcMain } from 'electron'
import { ensureWorkerForConnection } from '@/main/cloudflare/ensureWorker'
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
        const token = (ensured as unknown as { adminToken: string }).adminToken
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
}
