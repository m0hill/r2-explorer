import { createReadStream, createWriteStream } from 'node:fs'
import path, { basename } from 'node:path'
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListBucketsCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { eq } from 'drizzle-orm'
import { Effect } from 'effect'
import { app, BrowserWindow, dialog, ipcMain, safeStorage } from 'electron'
import started from 'electron-squirrel-startup'
import { db } from '@/main/db'
import { connections } from '@/main/db/schema'
import type { AddConnectionData } from '@/preload'

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit()
}

// Global state for active S3 client and main window reference
let _s3Client: S3Client | null = null
let mainWindow: BrowserWindow | null = null

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`))
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// IPC Handlers
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
      return yield* Effect.fail(new Error('Encryption not available'))
    }

    const secretAccessKeyEncrypted = safeStorage.encryptString(data.secretAccessKey)

    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .insert(connections)
          .values({
            name: data.name,
            accountId: data.accountId,
            accessKeyId: data.accessKeyId,
            secretAccessKeyEncrypted,
          })
          .returning({ id: connections.id }),
      catch: error => {
        console.error('Error adding connection:', error)
        return new Error('Failed to add connection')
      },
    })

    return result[0].id
  }).pipe(Effect.runPromise)
)

ipcMain.handle('connections:delete', (_, id: number) =>
  Effect.tryPromise({
    try: () => db.delete(connections).where(eq(connections.id, id)),
    catch: error => {
      console.error('Error deleting connection:', error)
      return new Error('Failed to delete connection')
    },
  }).pipe(
    Effect.map(() => true),
    Effect.runPromise
  )
)

ipcMain.handle('r2:connect', (_, id: number) =>
  Effect.gen(function* () {
    const connectionResults = yield* Effect.tryPromise({
      try: () => db.select().from(connections).where(eq(connections.id, id)).limit(1),
      catch: error => {
        console.error('Error fetching connection:', error)
        return new Error('Failed to fetch connection')
      },
    })

    if (connectionResults.length === 0) {
      yield* Effect.fail(new Error('Connection not found'))
    }

    if (!safeStorage.isEncryptionAvailable()) {
      yield* Effect.fail(new Error('Encryption not available'))
    }

    const { accountId, accessKeyId, secretAccessKeyEncrypted } = connectionResults[0]
    const secretAccessKey = safeStorage.decryptString(secretAccessKeyEncrypted as Buffer)

    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    })

    yield* Effect.tryPromise({
      try: () => client.send(new ListBucketsCommand({})),
      catch: error => {
        console.error('Error connecting to R2:', error)
        _s3Client = null
        return new Error(
          `R2 connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      },
    })

    _s3Client = client
    return { success: true }
  }).pipe(
    Effect.catchAll(error =>
      Effect.succeed({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    ),
    Effect.runPromise
  )
)

ipcMain.handle('r2:list-buckets', () =>
  Effect.gen(function* () {
    if (!_s3Client) {
      yield* Effect.fail(new Error('Not connected to R2'))
    }

    const response = yield* Effect.tryPromise({
      try: () => _s3Client!.send(new ListBucketsCommand({})),
      catch: error => {
        console.error('Error listing buckets:', error)
        return new Error('Failed to list buckets')
      },
    })

    return response.Buckets || []
  }).pipe(Effect.runPromise)
)

ipcMain.handle('r2:create-bucket', (_, bucketName: string) =>
  Effect.gen(function* () {
    if (!_s3Client) {
      yield* Effect.fail(new Error('Not connected to R2'))
    }

    yield* Effect.tryPromise({
      try: () => _s3Client!.send(new CreateBucketCommand({ Bucket: bucketName })),
      catch: error => {
        console.error('Error creating bucket:', error)
        return new Error(
          `Failed to create bucket: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      },
    })

    return { success: true }
  }).pipe(Effect.runPromise)
)

ipcMain.handle('r2:delete-bucket', (_, bucketName: string) =>
  Effect.gen(function* () {
    if (!_s3Client) {
      yield* Effect.fail(new Error('Not connected to R2'))
    }

    yield* Effect.tryPromise({
      try: () => _s3Client!.send(new DeleteBucketCommand({ Bucket: bucketName })),
      catch: error => {
        console.error('Error deleting bucket:', error)
        return new Error(
          `Failed to delete bucket: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      },
    })

    return { success: true }
  }).pipe(Effect.runPromise)
)

ipcMain.handle(
  'r2:list-objects',
  (_, { bucketName, prefix }: { bucketName: string; prefix?: string }) =>
    Effect.gen(function* () {
      if (!_s3Client) {
        yield* Effect.fail(new Error('Not connected to R2'))
      }

      const command = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
        Delimiter: '/',
      })

      const response = yield* Effect.tryPromise({
        try: () => _s3Client!.send(command),
        catch: error => {
          console.error('Error listing objects:', error)
          return new Error('Failed to list objects')
        },
      })

      const folders = response.CommonPrefixes?.map(p => p.Prefix!) ?? []
      const objects =
        response.Contents?.map(o => ({
          key: o.Key!,
          size: o.Size,
          lastModified: o.LastModified,
          etag: o.ETag,
        })) ?? []

      return { folders, objects }
    }).pipe(Effect.runPromise)
)

ipcMain.handle(
  'r2:upload-object',
  (_, { bucketName, prefix }: { bucketName: string; prefix?: string }) =>
    Effect.gen(function* () {
      if (!_s3Client) {
        yield* Effect.fail(new Error('Not connected to R2'))
      }

      const result = yield* Effect.tryPromise({
        try: () =>
          dialog.showOpenDialog({
            properties: ['openFile'],
          }),
        catch: error => {
          console.error('Error opening file dialog:', error)
          return new Error('Failed to open file dialog')
        },
      })

      if (result.canceled || !result.filePaths.length) {
        return { success: false, cancelled: true }
      }

      const filePath = result.filePaths[0]
      const fileName = basename(filePath)
      const key = prefix ? `${prefix}${fileName}` : fileName

      const fileStream = createReadStream(filePath)

      const upload = new Upload({
        client: _s3Client!,
        params: {
          Bucket: bucketName,
          Key: key,
          Body: fileStream,
        },
      })

      upload.on('httpUploadProgress', progress => {
        if (progress.loaded && progress.total) {
          const percentage = Math.round((progress.loaded / progress.total) * 100)
          mainWindow?.webContents.send('upload-progress', { key, progress: percentage })
        }
      })

      yield* Effect.tryPromise({
        try: () => upload.done(),
        catch: error => {
          console.error('Error uploading object:', error)
          return new Error(
            `Failed to upload object: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        },
      })

      return { success: true }
    }).pipe(Effect.runPromise)
)

ipcMain.handle(
  'r2:download-object',
  (_, { bucketName, key }: { bucketName: string; key: string }) =>
    Effect.gen(function* () {
      if (!_s3Client) {
        yield* Effect.fail(new Error('Not connected to R2'))
      }

      const result = yield* Effect.tryPromise({
        try: () =>
          dialog.showSaveDialog({
            defaultPath: basename(key),
          }),
        catch: error => {
          console.error('Error opening save dialog:', error)
          return new Error('Failed to open save dialog')
        },
      })

      if (result.canceled || !result.filePath) {
        return { success: false, cancelled: true }
      }

      const response = yield* Effect.tryPromise({
        try: () =>
          _s3Client!.send(
            new GetObjectCommand({
              Bucket: bucketName,
              Key: key,
            })
          ),
        catch: error => {
          console.error('Error downloading object:', error)
          return new Error(
            `Failed to download object: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        },
      })

      if (!response.Body) {
        yield* Effect.fail(new Error('No body in response'))
      }

      const writeStream = createWriteStream(result.filePath)

      yield* Effect.tryPromise({
        try: () =>
          new Promise<void>((resolve, reject) => {
            const body = response.Body as NodeJS.ReadableStream
            body.pipe(writeStream)
            body.on('error', reject)
            writeStream.on('error', reject)
            writeStream.on('close', resolve)
          }),
        catch: error => {
          console.error('Error writing file:', error)
          return new Error(
            `Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        },
      })

      return { success: true }
    }).pipe(Effect.runPromise)
)

ipcMain.handle('r2:delete-object', (_, { bucketName, key }: { bucketName: string; key: string }) =>
  Effect.gen(function* () {
    if (!_s3Client) {
      yield* Effect.fail(new Error('Not connected to R2'))
    }

    yield* Effect.tryPromise({
      try: () =>
        _s3Client!.send(
          new DeleteObjectCommand({
            Bucket: bucketName,
            Key: key,
          })
        ),
      catch: error => {
        console.error('Error deleting object:', error)
        return new Error(
          `Failed to delete object: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      },
    })

    return { success: true }
  }).pipe(Effect.runPromise)
)
