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

const api = {
  getConnections: (): Promise<ConnectionDisplay[]> => ipcRenderer.invoke('connections:get'),
  addConnection: (data: AddConnectionData): Promise<number> =>
    ipcRenderer.invoke('connections:add', data),
  deleteConnection: (id: number): Promise<boolean> => ipcRenderer.invoke('connections:delete', id),
  connectToR2: (id: number): Promise<ConnectResult> => ipcRenderer.invoke('r2:connect', id),
}

contextBridge.exposeInMainWorld('api', api)

declare global {
  interface Window {
    api: typeof api
  }
}
