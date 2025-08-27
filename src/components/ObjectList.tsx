import React from 'react'
import type { R2Object } from '@/preload'

interface ObjectListProps {
  data?: {
    folders: string[]
    objects: R2Object[]
  }
  prefix: string
  uploadProgress: Record<string, number>
  actioningObjects: Set<string>
  selectedKeys: Set<string>
  onFolderClick: (folderPrefix: string) => void
  onShareFolder: (folderPrefix: string) => void
  onSelectionToggle: (key: string) => void
  onDownload: (key: string) => void
  onShare: (object: R2Object) => void
  onDelete: (key: string) => void
  downloadMutation: {
    isPending: boolean
    variables?: { key: string }
  }
  deleteMutation: {
    isPending: boolean
    variables?: { key: string }
  }
}

const ObjectList: React.FC<ObjectListProps> = ({
  data,
  prefix,
  uploadProgress,
  actioningObjects,
  selectedKeys,
  onFolderClick,
  onShareFolder,
  onSelectionToggle,
  onDownload,
  onShare,
  onDelete,
  downloadMutation,
  deleteMutation,
}) => {
  const formatSize = (bytes?: number) => {
    if (!bytes) return '0 B'
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
  }

  const formatDate = (date?: Date) => {
    if (!date) return ''
    return new Date(date).toLocaleString()
  }

  return (
    <div className="divide-y divide-gray-200">
      {Object.entries(uploadProgress).map(([key, progress]) => {
        const fileName = key.replace(prefix, '')
        const existingObject = data?.objects?.find(obj => obj.key === key)

        if (existingObject) return null

        return (
          <div key={key} className="px-6 py-4 flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-gray-900">{fileName}</p>
              <div className="mt-2">
                <div className="flex items-center">
                  <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-600 w-12">{progress}%</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Uploading...</p>
              </div>
            </div>
          </div>
        )
      })}

      {data?.folders?.map(folder => (
        <div key={folder} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
          <div className="flex items-center flex-1">
            <div className="flex-shrink-0 mr-3">
              <input
                type="checkbox"
                checked={selectedKeys.has(folder)}
                onChange={() => onSelectionToggle(folder)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                onClick={e => e.stopPropagation()}
              />
            </div>
            <div
              className="flex items-center flex-1 cursor-pointer"
              onClick={() => onFolderClick(folder)}
            >
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {folder.replace(prefix, '').replace('/', '')}
                </p>
                <p className="text-sm text-gray-500">Folder</p>
              </div>
            </div>
          </div>
          <div className="ml-4">
            <button
              onClick={e => {
                e.stopPropagation()
                onShareFolder(folder)
              }}
              className="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
            >
              Share
            </button>
          </div>
        </div>
      ))}

      {data?.objects?.map(object => {
        const fileName = object.key.replace(prefix, '')
        const isUploading = uploadProgress[object.key] !== undefined
        const isActioning = actioningObjects.has(object.key)

        return (
          <div key={object.key} className="px-6 py-4 flex items-center">
            <div className="flex-shrink-0 mr-3">
              <input
                type="checkbox"
                checked={selectedKeys.has(object.key)}
                onChange={() => onSelectionToggle(object.key)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-gray-900">{fileName}</p>
              {isUploading ? (
                <div className="mt-2">
                  <div className="flex items-center">
                    <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress[object.key]}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600 w-12">
                      {uploadProgress[object.key]}%
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span>{formatSize(object.size)}</span>
                  {object.lastModified && <span>Modified {formatDate(object.lastModified)}</span>}
                </div>
              )}
            </div>
            <div className="ml-4 flex space-x-2">
              <button
                onClick={() => onDownload(object.key)}
                disabled={isActioning || isUploading}
                className="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isActioning && downloadMutation.variables?.key === object.key ? (
                  <div className="animate-spin h-3 w-3 border border-gray-400 border-t-transparent rounded-full" />
                ) : (
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                )}
                <span className="ml-1">Download</span>
              </button>
              <button
                onClick={() => onShare(object)}
                disabled={isActioning || isUploading}
                className="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Share
              </button>
              <button
                onClick={() => onDelete(object.key)}
                disabled={isActioning || isUploading}
                className="inline-flex items-center px-2 py-1 border border-red-300 shadow-sm text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isActioning && deleteMutation.variables?.key === object.key ? (
                  <div className="animate-spin h-3 w-3 border border-red-400 border-t-transparent rounded-full" />
                ) : (
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                )}
                <span className="ml-1">Delete</span>
              </button>
            </div>
          </div>
        )
      })}

      {(!data?.folders || data.folders.length === 0) &&
        (!data?.objects || data.objects.length === 0) && (
          <div className="px-6 py-8 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No objects</h3>
            <p className="mt-1 text-sm text-gray-500">This folder is empty.</p>
          </div>
        )}
    </div>
  )
}

export default ObjectList
