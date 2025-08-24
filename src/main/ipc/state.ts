import type { S3Client } from '@aws-sdk/client-s3'
import type { BrowserWindow } from 'electron'

export const appState = {
  s3Client: null as S3Client | null,
  mainWindow: null as BrowserWindow | null,
}
