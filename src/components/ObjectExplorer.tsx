import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import React, { useEffect, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import type { R2Object } from '@/preload'
import ActionToolbar from './ActionToolbar'
import CreateFolderModal from './CreateFolderModal'
import InlineFolderShares from './InlineFolderShares'
import ObjectHeader from './ObjectHeader'
import ObjectList from './ObjectList'
import ShareFolderModal from './ShareFolderModal'
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
  const [sharingFolderPrefix, setSharingFolderPrefix] = useState<string | null>(null)
  const [isCreateFolderModalOpen, setCreateFolderModalOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['objects', bucketName, prefix],
    queryFn: () => window.api.listObjects({ bucketName, prefix }),
  })

  const uploadMutation = useMutation({
    mutationFn: () => window.api.uploadObjects({ bucketName, prefix }),
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

  const bulkDownloadMutation = useMutation({
    mutationFn: (keys: string[]) => window.api.downloadObjects({ bucketName, keys }),
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

  const handleBulkDownload = () => {
    if (selectedKeys.size === 0) return

    const selectedItems = Array.from(selectedKeys)
    bulkDownloadMutation.mutate(selectedItems)
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

  const handleShareCurrentFolder = () => {
    if (prefix) setSharingFolderPrefix(prefix)
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

  const handleShareFolder = (folderPrefix: string) => {
    setSharingFolderPrefix(folderPrefix)
    // Worker provisioning and share creation are handled in the modal via mutation
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading objects...</p>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error?.message || 'Failed to load objects'}</AlertDescription>
      </Alert>
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
        onShareCurrentFolder={handleShareCurrentFolder}
      />

      <ActionToolbar
        selectedKeysCount={selectedKeys.size}
        onClearSelection={() => setSelectedKeys(new Set())}
        onBulkDelete={handleBulkDelete}
        bulkDeleteMutation={bulkDeleteMutation}
        onBulkDownload={handleBulkDownload}
        bulkDownloadMutation={bulkDownloadMutation}
      />

      <Card>
        <ObjectList
          data={data}
          prefix={prefix}
          uploadProgress={uploadProgress}
          actioningObjects={actioningObjects}
          selectedKeys={selectedKeys}
          onFolderClick={handleFolderClick}
          onShareFolder={handleShareFolder}
          onSelectionToggle={handleSelectionToggle}
          onDownload={handleDownload}
          onShare={handleShareClick}
          onDelete={handleDelete}
          downloadMutation={downloadMutation}
          deleteMutation={deleteMutation}
        />
      </Card>

      {/* Inline Shares list for this folder context */}
      <InlineFolderShares
        bucketName={bucketName}
        currentPrefix={prefix}
        onShareCurrent={handleShareCurrentFolder}
      />

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

      {sharingFolderPrefix && (
        <ShareFolderModal
          isOpen={!!sharingFolderPrefix}
          onClose={() => setSharingFolderPrefix(null)}
          bucketName={bucketName}
          folderPrefix={sharingFolderPrefix}
        />
      )}
    </div>
  )
}

export default ObjectExplorer
