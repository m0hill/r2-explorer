import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import React, { useEffect, useState } from 'react'

interface ObjectExplorerProps {
  bucketName: string
  onBack: () => void
}

const ObjectExplorer: React.FC<ObjectExplorerProps> = ({ bucketName, onBack }) => {
  const [prefix, setPrefix] = useState('')
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [actioningObjects, setActioningObjects] = useState<Set<string>>(new Set())
  const queryClient = useQueryClient()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['objects', bucketName, prefix],
    queryFn: () => window.api.listObjects({ bucketName, prefix }),
  })

  const uploadMutation = useMutation({
    mutationFn: () => window.api.uploadObject({ bucketName, prefix }),
    onSuccess: result => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['objects', bucketName, prefix] })
      }
    },
  })

  const downloadMutation = useMutation({
    mutationFn: ({ key }: { key: string }) => window.api.downloadObject({ bucketName, key }),
    onMutate: ({ key }) => {
      setActioningObjects(prev => new Set([...prev, key]))
    },
    onSettled: (_, __, { key }) => {
      setActioningObjects(prev => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: ({ key }: { key: string }) => window.api.deleteObject({ bucketName, key }),
    onMutate: ({ key }) => {
      setActioningObjects(prev => new Set([...prev, key]))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objects', bucketName, prefix] })
    },
    onSettled: (_, __, { key }) => {
      setActioningObjects(prev => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    },
  })

  useEffect(() => {
    const cleanup = window.api.onUploadProgress(({ key, progress }) => {
      setUploadProgress(prev => ({ ...prev, [key]: progress }))
      if (progress === 100) {
        setTimeout(() => {
          setUploadProgress(prev => {
            const { [key]: _, ...rest } = prev
            return rest
          })
        }, 2000)
      }
    })
    return cleanup
  }, [])

  const handleUpload = () => {
    uploadMutation.mutate()
  }

  const handleDownload = (key: string) => {
    downloadMutation.mutate({ key })
  }

  const handleDelete = (key: string) => {
    if (window.confirm(`Are you sure you want to delete "${key.replace(prefix, '')}"?`)) {
      deleteMutation.mutate({ key })
    }
  }

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

  const handleFolderClick = (folderPrefix: string) => {
    setPrefix(folderPrefix)
  }

  const breadcrumbs = prefix ? prefix.split('/').filter(Boolean) : []

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      setPrefix('')
    } else {
      const newPrefix = breadcrumbs.slice(0, index + 1).join('/') + '/'
      setPrefix(newPrefix)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading objects...</p>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading objects</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error?.message || 'Failed to load objects'}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center space-x-2 text-sm">
          <button onClick={onBack} className="text-blue-600 hover:text-blue-800 font-medium">
            {bucketName}
          </button>
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={index}>
              <span className="text-gray-400">/</span>
              <button
                onClick={() => handleBreadcrumbClick(index)}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                {crumb}
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Objects List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Contents</h2>
            <p className="text-sm text-gray-500 mt-1">
              {(data?.folders?.length || 0) + (data?.objects?.length || 0)} items
            </p>
          </div>
          <button
            onClick={handleUpload}
            disabled={uploadMutation.isPending}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploadMutation.isPending ? (
              <>
                <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                Uploading...
              </>
            ) : (
              <>
                <svg
                  className="-ml-1 mr-2 h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                Upload File
              </>
            )}
          </button>
        </div>

        <div className="divide-y divide-gray-200">
          {/* Upload Progress Items */}
          {Object.entries(uploadProgress).map(([key, progress]) => {
            const fileName = key.replace(prefix, '')
            const existingObject = data?.objects?.find(obj => obj.key === key)

            if (existingObject) return null // Will be rendered in the regular objects list

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

          {/* Folders */}
          {data?.folders?.map(folder => (
            <div
              key={folder}
              className="px-6 py-4 flex items-center cursor-pointer hover:bg-gray-50"
              onClick={() => handleFolderClick(folder)}
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
          ))}

          {/* Files */}
          {data?.objects?.map(object => {
            const fileName = object.key.replace(prefix, '')
            const isUploading = uploadProgress[object.key] !== undefined
            const isActioning = actioningObjects.has(object.key)

            return (
              <div key={object.key} className="px-6 py-4 flex items-center">
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
                      {object.lastModified && (
                        <span>Modified {formatDate(object.lastModified)}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="ml-4 flex space-x-2">
                  <button
                    onClick={() => handleDownload(object.key)}
                    disabled={isActioning || isUploading}
                    className="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isActioning && downloadMutation.variables?.key === object.key ? (
                      <div className="animate-spin h-3 w-3 border border-gray-400 border-t-transparent rounded-full" />
                    ) : (
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
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
                    onClick={() => handleDelete(object.key)}
                    disabled={isActioning || isUploading}
                    className="inline-flex items-center px-2 py-1 border border-red-300 shadow-sm text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isActioning && deleteMutation.variables?.key === object.key ? (
                      <div className="animate-spin h-3 w-3 border border-red-400 border-t-transparent rounded-full" />
                    ) : (
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
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

          {/* Empty state */}
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
      </div>
    </div>
  )
}

export default ObjectExplorer
