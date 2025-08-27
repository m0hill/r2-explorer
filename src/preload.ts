import type { Bucket } from '@aws-sdk/client-s3'
import { contextBridge, ipcRenderer } from 'electron'
import type { Connection, NewConnection } from './main/db/schema'

export type AddConnectionData = Omit<
  NewConnection,
  'id' | 'secretAccessKeyEncrypted' | 'apiTokenEncrypted' | 'workerName' | 'workerSubdomain'
> & {
  secretAccessKey: string
  apiToken?: string
}

export type ConnectResult = {
  success: boolean
  error?: string
}

export type ConnectionDisplay = Omit<Connection, 'secretAccessKeyEncrypted'>

export type BucketResult = {
  success?: boolean
  error?: string
}

export type R2Object = {
  key: string
  size?: number
  lastModified?: Date
  etag?: string
}

export type ListObjectsResult = {
  folders: string[]
  objects: R2Object[]
}

export type PresignedUrlData = {
  id: number
  url: string
  expiresAt: string
}

export type FolderShareResult = {
  id: string
  url: string
  expiresAt: string
}

const api = {
  getConnections: (): Promise<ConnectionDisplay[]> => ipcRenderer.invoke('connections:get'),
  addConnection: (data: AddConnectionData): Promise<number> =>
    ipcRenderer.invoke('connections:add', data),
  updateConnection: (id: number, data: AddConnectionData): Promise<number> =>
    ipcRenderer.invoke('connections:update', id, data),
  deleteConnection: (id: number): Promise<boolean> => ipcRenderer.invoke('connections:delete', id),
  connectToR2: (id: number): Promise<ConnectResult> => ipcRenderer.invoke('r2:connect', id),
  listBuckets: (): Promise<Bucket[] | undefined> => ipcRenderer.invoke('r2:list-buckets'),
  createBucket: (bucketName: string): Promise<BucketResult> =>
    ipcRenderer.invoke('r2:create-bucket', bucketName),
  deleteBucket: (bucketName: string): Promise<BucketResult> =>
    ipcRenderer.invoke('r2:delete-bucket', bucketName),
  listObjects: (params: { bucketName: string; prefix?: string }): Promise<ListObjectsResult> =>
    ipcRenderer.invoke('r2:list-objects', params),
  uploadObjects: (params: {
    bucketName: string
    prefix?: string
  }): Promise<{ success: boolean; cancelled?: boolean }> =>
    ipcRenderer.invoke('r2:upload-object', params),
  downloadObject: (params: {
    bucketName: string
    key: string
  }): Promise<{ success: boolean; cancelled?: boolean }> =>
    ipcRenderer.invoke('r2:download-object', params),
  deleteObject: (params: { bucketName: string; key: string }): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('r2:delete-object', params),
  deleteObjects: (params: {
    bucketName: string
    keys: string[]
  }): Promise<{ success: boolean; deletedCount: number }> =>
    ipcRenderer.invoke('r2:delete-objects', params),
  downloadObjects: (params: {
    bucketName: string
    keys: string[]
  }): Promise<{ success: boolean; cancelled?: boolean }> =>
    ipcRenderer.invoke('r2:download-objects', params),
  getPresignedUrl: (params: {
    bucketName: string
    key: string
  }): Promise<PresignedUrlData | null> => ipcRenderer.invoke('urls:get-for-object', params),
  createPresignedUrl: (params: {
    bucketName: string
    key: string
    expiresIn: number
  }): Promise<PresignedUrlData> => ipcRenderer.invoke('urls:create-for-object', params),
  createFolder: (params: {
    bucketName: string
    folderPath: string
  }): Promise<{ success: boolean }> => ipcRenderer.invoke('r2:create-folder', params),
  ensureShareWorker: (): Promise<{ workerUrl: string }> => ipcRenderer.invoke('worker:ensure'),
  createFolderShare: (params: {
    bucketName: string
    prefix: string
    expiresIn: number
    pin?: string
  }): Promise<FolderShareResult> => ipcRenderer.invoke('folder-share:create', params),

  onUploadProgress: (callback: (data: { key: string; progress: number }) => void) => {
    const handler = (_event: unknown, data: { key: string; progress: number }) => callback(data)
    ipcRenderer.on('upload-progress', handler)
    // Return a cleanup function
    return () => {
      ipcRenderer.removeListener('upload-progress', handler)
    }
  },
}

contextBridge.exposeInMainWorld('api', api)

declare global {
  interface Window {
    api: typeof api
  }
}
