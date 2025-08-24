import { createReadStream, createWriteStream } from 'node:fs'
import { basename } from 'node:path'
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListBucketsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { and, eq } from 'drizzle-orm'
import { Effect } from 'effect'
import { dialog, ipcMain } from 'electron'
import { db } from '@/main/db'
import { presignedUrls } from '@/main/db/schema'
import { appState } from './state'

export function registerR2Handlers() {
  ipcMain.handle('r2:list-buckets', () =>
    Effect.gen(function* () {
      if (!appState.s3Client) {
        yield* Effect.fail(new Error('Not connected to R2'))
      }

      const response = yield* Effect.tryPromise(() =>
        appState.s3Client!.send(new ListBucketsCommand({}))
      )

      return response.Buckets || []
    }).pipe(
      Effect.catchAll(error =>
        Effect.fail(
          new Error(
            `Failed to list buckets: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        )
      ),
      Effect.runPromise
    )
  )

  ipcMain.handle('r2:create-bucket', (_, bucketName: string) =>
    Effect.gen(function* () {
      if (!appState.s3Client) {
        yield* Effect.fail(new Error('Not connected to R2'))
      }

      yield* Effect.tryPromise(() =>
        appState.s3Client!.send(new CreateBucketCommand({ Bucket: bucketName }))
      )

      return { success: true }
    }).pipe(
      Effect.catchAll(error =>
        Effect.fail(
          new Error(
            `Failed to create bucket: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        )
      ),
      Effect.runPromise
    )
  )

  ipcMain.handle('r2:delete-bucket', (_, bucketName: string) =>
    Effect.gen(function* () {
      if (!appState.s3Client) {
        yield* Effect.fail(new Error('Not connected to R2'))
      }

      yield* Effect.tryPromise(() =>
        appState.s3Client!.send(new DeleteBucketCommand({ Bucket: bucketName }))
      )

      return { success: true }
    }).pipe(
      Effect.catchAll(error =>
        Effect.fail(
          new Error(
            `Failed to delete bucket: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        )
      ),
      Effect.runPromise
    )
  )

  ipcMain.handle(
    'r2:list-objects',
    (_, { bucketName, prefix }: { bucketName: string; prefix?: string }) =>
      Effect.gen(function* () {
        if (!appState.s3Client) {
          yield* Effect.fail(new Error('Not connected to R2'))
        }

        const command = new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: prefix,
          Delimiter: '/',
        })

        const response = yield* Effect.tryPromise(() => appState.s3Client!.send(command))

        const folders = response.CommonPrefixes?.map(p => p.Prefix!) ?? []
        const objects =
          response.Contents?.map(o => ({
            key: o.Key!,
            size: o.Size,
            lastModified: o.LastModified,
            etag: o.ETag,
          })) ?? []

        return { folders, objects }
      }).pipe(
        Effect.catchAll(error =>
          Effect.fail(
            new Error(
              `Failed to list objects: ${error instanceof Error ? error.message : 'Unknown error'}`
            )
          )
        ),
        Effect.runPromise
      )
  )

  ipcMain.handle(
    'r2:upload-object',
    (_, { bucketName, prefix }: { bucketName: string; prefix?: string }) =>
      Effect.gen(function* () {
        if (!appState.s3Client) {
          yield* Effect.fail(new Error('Not connected to R2'))
        }

        // 1. Allow multiple file selections in the dialog
        const result = yield* Effect.tryPromise(() =>
          dialog.showOpenDialog({
            properties: ['openFile', 'multiSelections'],
          })
        )

        if (result.canceled || !result.filePaths.length) {
          return { success: false, cancelled: true }
        }

        // 2. Create an array of upload Effects for each selected file
        const uploadEffects = result.filePaths.map(filePath => {
          const fileName = basename(filePath)
          const key = prefix ? `${prefix}${fileName}` : fileName
          const fileStream = createReadStream(filePath)

          const upload = new Upload({
            client: appState.s3Client!,
            params: {
              Bucket: bucketName,
              Key: key,
              Body: fileStream,
            },
          })

          // The progress handler remains the same and will emit events for each file's key
          upload.on('httpUploadProgress', progress => {
            if (progress.loaded && progress.total) {
              const percentage = Math.round((progress.loaded / progress.total) * 100)
              appState.mainWindow?.webContents.send('upload-progress', {
                key,
                progress: percentage,
              })
            }
          })

          return Effect.tryPromise(() => upload.done())
        })

        // 3. Run all upload effects concurrently
        yield* Effect.all(uploadEffects, { concurrency: 10 })

        return { success: true }
      }).pipe(
        Effect.catchAll(error =>
          Effect.fail(
            new Error(
              `Failed to upload object: ${error instanceof Error ? error.message : 'Unknown error'}`
            )
          )
        ),
        Effect.runPromise
      )
  )

  ipcMain.handle(
    'r2:download-object',
    (_, { bucketName, key }: { bucketName: string; key: string }) =>
      Effect.gen(function* () {
        if (!appState.s3Client) {
          yield* Effect.fail(new Error('Not connected to R2'))
        }

        const result = yield* Effect.tryPromise(() =>
          dialog.showSaveDialog({
            defaultPath: basename(key),
          })
        )

        if (result.canceled || !result.filePath) {
          return { success: false, cancelled: true }
        }

        const response = yield* Effect.tryPromise(() =>
          appState.s3Client!.send(
            new GetObjectCommand({
              Bucket: bucketName,
              Key: key,
            })
          )
        )

        if (!response.Body) {
          yield* Effect.fail(new Error('No body in response'))
        }

        const writeStream = createWriteStream(result.filePath)

        yield* Effect.tryPromise(
          () =>
            new Promise<void>((resolve, reject) => {
              const body = response.Body as NodeJS.ReadableStream
              body.pipe(writeStream)
              body.on('error', reject)
              writeStream.on('error', reject)
              writeStream.on('close', resolve)
            })
        )

        return { success: true }
      }).pipe(
        Effect.catchAll(error =>
          Effect.fail(
            new Error(
              `Failed to download object: ${error instanceof Error ? error.message : 'Unknown error'}`
            )
          )
        ),
        Effect.runPromise
      )
  )

  ipcMain.handle(
    'r2:delete-object',
    (_, { bucketName, key }: { bucketName: string; key: string }) =>
      Effect.gen(function* () {
        if (!appState.s3Client) {
          yield* Effect.fail(new Error('Not connected to R2'))
        }

        yield* Effect.tryPromise(() =>
          appState.s3Client!.send(
            new DeleteObjectCommand({
              Bucket: bucketName,
              Key: key,
            })
          )
        )

        return { success: true }
      }).pipe(
        Effect.catchAll(error =>
          Effect.fail(
            new Error(
              `Failed to delete object: ${error instanceof Error ? error.message : 'Unknown error'}`
            )
          )
        ),
        Effect.runPromise
      )
  )

  ipcMain.handle(
    'r2:create-folder',
    (_, { bucketName, folderPath }: { bucketName: string; folderPath: string }) =>
      Effect.gen(function* () {
        if (!appState.s3Client) {
          yield* Effect.fail(new Error('Not connected to R2'))
        }

        const command = new PutObjectCommand({
          Bucket: bucketName,
          Key: folderPath,
          Body: '',
        })

        yield* Effect.tryPromise(() => appState.s3Client!.send(command))

        return { success: true }
      }).pipe(
        Effect.catchAll(error =>
          Effect.fail(
            new Error(
              `Failed to create folder: ${error instanceof Error ? error.message : 'Unknown error'}`
            )
          )
        ),
        Effect.runPromise
      )
  )

  ipcMain.handle(
    'urls:get-for-object',
    (_, { bucketName, key }: { bucketName: string; key: string }) =>
      Effect.gen(function* () {
        const results = yield* Effect.tryPromise(() =>
          db
            .select()
            .from(presignedUrls)
            .where(and(eq(presignedUrls.bucketName, bucketName), eq(presignedUrls.objectKey, key)))
            .limit(1)
        )

        if (results.length === 0) {
          return null
        }

        const result = results[0]!

        // Check if URL has expired
        const expiresAt = new Date(result.expiresAt)
        if (expiresAt <= new Date()) {
          // Delete expired entry
          yield* Effect.tryPromise(() =>
            db.delete(presignedUrls).where(eq(presignedUrls.id, result.id))
          )
          return null
        }

        return {
          id: result.id,
          url: result.url,
          expiresAt: result.expiresAt,
        }
      }).pipe(
        Effect.catchAll(error =>
          Effect.fail(
            new Error(
              `Failed to get presigned URL: ${error instanceof Error ? error.message : 'Unknown error'}`
            )
          )
        ),
        Effect.runPromise
      )
  )

  ipcMain.handle(
    'urls:create-for-object',
    (_, { bucketName, key, expiresIn }: { bucketName: string; key: string; expiresIn: number }) =>
      Effect.gen(function* () {
        if (!appState.s3Client) {
          yield* Effect.fail(new Error('Not connected to R2'))
        }

        const command = new GetObjectCommand({ Bucket: bucketName, Key: key })

        const url = yield* Effect.tryPromise(() =>
          getSignedUrl(appState.s3Client!, command, { expiresIn })
        )

        const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

        // Delete any existing URL for this object
        yield* Effect.tryPromise(() =>
          db
            .delete(presignedUrls)
            .where(and(eq(presignedUrls.bucketName, bucketName), eq(presignedUrls.objectKey, key)))
        )

        // Insert new URL
        const result = yield* Effect.tryPromise(() =>
          db
            .insert(presignedUrls)
            .values({
              objectKey: key,
              bucketName,
              url,
              expiresAt,
            })
            .returning({ id: presignedUrls.id })
        )

        return {
          id: result[0]!.id,
          url,
          expiresAt,
        }
      }).pipe(
        Effect.catchAll(error =>
          Effect.fail(
            new Error(
              `Failed to create presigned URL: ${error instanceof Error ? error.message : 'Unknown error'}`
            )
          )
        ),
        Effect.runPromise
      )
  )

  ipcMain.handle(
    'r2:delete-objects',
    (_, { bucketName, keys }: { bucketName: string; keys: string[] }) =>
      Effect.gen(function* () {
        if (!appState.s3Client) {
          yield* Effect.fail(new Error('Not connected to R2'))
        }

        if (keys.length === 0) {
          return { success: true, deletedCount: 0 }
        }

        const BATCH_SIZE = 1000
        let deletedCount = 0

        for (let i = 0; i < keys.length; i += BATCH_SIZE) {
          const batch = keys.slice(i, i + BATCH_SIZE)

          const command = new DeleteObjectsCommand({
            Bucket: bucketName,
            Delete: {
              Objects: batch.map(key => ({ Key: key })),
            },
          })

          const response = yield* Effect.tryPromise(() => appState.s3Client!.send(command))

          deletedCount += response.Deleted?.length || 0

          if (response.Errors && response.Errors.length > 0) {
            console.warn('Some objects failed to delete:', response.Errors)
          }
        }

        return { success: true, deletedCount }
      }).pipe(
        Effect.catchAll(error =>
          Effect.fail(
            new Error(
              `Failed to delete objects: ${error instanceof Error ? error.message : 'Unknown error'}`
            )
          )
        ),
        Effect.runPromise
      )
  )
}
