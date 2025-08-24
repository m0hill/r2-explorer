import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import React, { useEffect, useState } from 'react'
import type { R2Object } from '@/preload'
import ActionToolbar from './ActionToolbar'
import CreateFolderModal from './CreateFolderModal'
import ObjectHeader from './ObjectHeader'
import ObjectList from './ObjectList'
import ShareModal from './ShareModal'

interface ObjectExplorerProps {
  bucketName: string
  onBack: () => void
}

const ObjectExplorer: React.FC<ObjectExplorerProps> = ({ bucketName, onBack }) => {
  const [prefix, setPrefix] = useState('')
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [actioningObjects, setActioningObjects] = useState<Set<string>>(new Set())
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())

  const [sharingObject, setSharingObject] = useState<R2Object | null>(null)
  const [isCreateFolderModalOpen, setCreateFolderModalOpen] = useState(false)
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

  const createFolderMutation = useMutation({
    mutationFn: (folderPath: string) => window.api.createFolder({ bucketName, folderPath }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objects', bucketName, prefix] })
    },
    onError: error => {
      alert(`Failed to create folder: ${error.message}`)
    },
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: (keys: string[]) => window.api.deleteObjects({ bucketName, keys }),
    onSuccess: () => {
      setSelectedKeys(new Set())
      queryClient.invalidateQueries({ queryKey: ['objects', bucketName, prefix] })
    },
  })

  const handleShareClick = (object: R2Object) => {
    setSharingObject(object)
  }

  const handleSelectionToggle = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    const allKeys = [
      ...(data?.folders?.map(folder => folder) || []),
      ...(data?.objects?.map(object => object.key) || []),
    ]

    const allSelected = allKeys.every(key => selectedKeys.has(key))

    if (allSelected) {
      setSelectedKeys(new Set())
    } else {
      setSelectedKeys(new Set(allKeys))
    }
  }

  const handleBulkDelete = () => {
    if (selectedKeys.size === 0) return

    const selectedItems = Array.from(selectedKeys)
    const message = `Are you sure you want to delete ${selectedItems.length} item${selectedItems.length > 1 ? 's' : ''}?`

    if (window.confirm(message)) {
      bulkDeleteMutation.mutate(selectedItems)
    }
  }

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

  const handleCreateFolder = () => {
    setCreateFolderModalOpen(true)
  }

  const handleConfirmCreateFolder = (folderName: string) => {
    if (folderName) {
      const cleanFolderName = folderName.replace(/\/$/, '')
      const folderPath = `${prefix}${cleanFolderName}/`
      createFolderMutation.mutate(folderPath)
    }
  }

  const handleDownload = (key: string) => {
    downloadMutation.mutate({ key })
  }

  const handleDelete = (key: string) => {
    if (window.confirm(`Are you sure you want to delete "${key.replace(prefix, '')}"?`)) {
      deleteMutation.mutate({ key })
    }
  }

  const handleFolderClick = (folderPrefix: string) => {
    setPrefix(folderPrefix)
  }

  const handleBreadcrumbClick = (index: number) => {
    const breadcrumbs = prefix ? prefix.split('/').filter(Boolean) : []
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

  const allKeys = [...(data?.folders || []), ...(data?.objects?.map(obj => obj.key) || [])]
  const isAllSelected = allKeys.length > 0 && allKeys.every(key => selectedKeys.has(key))

  return (
    <div className="space-y-6">
      <ObjectHeader
        bucketName={bucketName}
        prefix={prefix}
        onBack={onBack}
        onBreadcrumbClick={handleBreadcrumbClick}
        onCreateFolder={handleCreateFolder}
        onUpload={handleUpload}
        createFolderMutation={createFolderMutation}
        uploadMutation={uploadMutation}
        objectCount={data?.objects?.length || 0}
        folderCount={data?.folders?.length || 0}
        onSelectAll={handleSelectAll}
        isAllSelected={isAllSelected}
      />

      <ActionToolbar
        selectedKeysCount={selectedKeys.size}
        onClearSelection={() => setSelectedKeys(new Set())}
        onBulkDelete={handleBulkDelete}
        bulkDeleteMutation={bulkDeleteMutation}
      />

      <div className="bg-white rounded-lg shadow">
        <ObjectList
          data={data}
          prefix={prefix}
          uploadProgress={uploadProgress}
          actioningObjects={actioningObjects}
          selectedKeys={selectedKeys}
          onFolderClick={handleFolderClick}
          onSelectionToggle={handleSelectionToggle}
          onDownload={handleDownload}
          onShare={handleShareClick}
          onDelete={handleDelete}
          downloadMutation={downloadMutation}
          deleteMutation={deleteMutation}
        />
      </div>

      <CreateFolderModal
        isOpen={isCreateFolderModalOpen}
        onClose={() => setCreateFolderModalOpen(false)}
        onCreate={handleConfirmCreateFolder}
      />

      {sharingObject && (
        <ShareModal
          isOpen={!!sharingObject}
          onClose={() => setSharingObject(null)}
          bucketName={bucketName}
          objectKey={sharingObject.key}
        />
      )}
    </div>
  )
}

export default ObjectExplorer
