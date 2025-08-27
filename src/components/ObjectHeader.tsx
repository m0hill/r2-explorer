import React from 'react'

interface ObjectHeaderProps {
  bucketName: string
  prefix: string
  onBack: () => void
  onBreadcrumbClick: (index: number) => void
  onCreateFolder: () => void
  onUpload: () => void
  createFolderMutation: { isPending: boolean }
  uploadMutation: { isPending: boolean }
  objectCount: number
  folderCount: number

  onSelectAll: () => void
  isAllSelected: boolean
  onShareCurrentFolder?: () => void
}

const ObjectHeader: React.FC<ObjectHeaderProps> = ({
  bucketName,
  prefix,
  onBack,
  onBreadcrumbClick,
  onCreateFolder,
  onUpload,
  createFolderMutation,
  uploadMutation,
  objectCount,
  folderCount,
  onSelectAll,
  isAllSelected,
  onShareCurrentFolder,
}) => {
  const breadcrumbs = prefix ? prefix.split('/').filter(Boolean) : []
  const totalItems = objectCount + folderCount

  return (
    <>
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center space-x-2 text-sm">
          <button onClick={onBack} className="text-blue-600 hover:text-blue-800 font-medium">
            {bucketName}
          </button>
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={index}>
              <span className="text-gray-400">/</span>
              <button
                onClick={() => onBreadcrumbClick(index)}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                {crumb}
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={totalItems > 0 && isAllSelected}
                onChange={onSelectAll}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Contents</h2>
              <p className="text-sm text-gray-500 mt-1">{totalItems} items</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={onCreateFolder}
              disabled={createFolderMutation.isPending}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createFolderMutation.isPending ? (
                <>
                  <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full"></div>
                  Creating...
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
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Create Folder
                </>
              )}
            </button>
            <button
              onClick={onShareCurrentFolder}
              disabled={!onShareCurrentFolder || prefix === ''}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                prefix === '' ? 'Open a folder to share it' : 'Create a share link for this folder'
              }
            >
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
                  d="M13 7H7v6m0 0h6m-6 0l8 8M21 3l-6 6"
                />
              </svg>
              Share This Folder
            </button>
            <button
              onClick={onUpload}
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
        </div>
      </div>
    </>
  )
}

export default ObjectHeader
