import { useQuery } from '@tanstack/react-query'
import React, { useState } from 'react'

interface ObjectExplorerProps {
  bucketName: string
  onBack: () => void
}

const ObjectExplorer: React.FC<ObjectExplorerProps> = ({ bucketName, onBack }) => {
  const [prefix, setPrefix] = useState('')

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['objects', bucketName, prefix],
    queryFn: () => window.api.listObjects({ bucketName, prefix }),
  })

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
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Contents</h2>
          <p className="text-sm text-gray-500 mt-1">
            {(data?.folders?.length || 0) + (data?.objects?.length || 0)} items
          </p>
        </div>

        <div className="divide-y divide-gray-200">
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
          {data?.objects?.map(object => (
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
                <p className="text-sm font-medium text-gray-900">
                  {object.key.replace(prefix, '')}
                </p>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span>{formatSize(object.size)}</span>
                  {object.lastModified && <span>Modified {formatDate(object.lastModified)}</span>}
                </div>
              </div>
            </div>
          ))}

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
