import type { Bucket } from '@aws-sdk/client-s3'
import { contextBridge, ipcRenderer } from 'electron'
import type { Connection, NewConnection } from './main/db/schema'

export type AddConnectionData = Omit<NewConnection, 'id' | 'secretAccessKeyEncrypted'> & {
  secretAccessKey: string
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

const api = {
  getConnections: (): Promise<ConnectionDisplay[]> => ipcRenderer.invoke('connections:get'),
  addConnection: (data: AddConnectionData): Promise<number> =>
    ipcRenderer.invoke('connections:add', data),
  deleteConnection: (id: number): Promise<boolean> => ipcRenderer.invoke('connections:delete', id),
  connectToR2: (id: number): Promise<ConnectResult> => ipcRenderer.invoke('r2:connect', id),
  listBuckets: (): Promise<Bucket[] | undefined> => ipcRenderer.invoke('r2:list-buckets'),
  createBucket: (bucketName: string): Promise<BucketResult> =>
    ipcRenderer.invoke('r2:create-bucket', bucketName),
  deleteBucket: (bucketName: string): Promise<BucketResult> =>
    ipcRenderer.invoke('r2:delete-bucket', bucketName),
}

contextBridge.exposeInMainWorld('api', api)

declare global {
  interface Window {
    api: typeof api
  }
}
