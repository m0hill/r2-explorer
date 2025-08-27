import type { Bucket } from '@aws-sdk/client-s3'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import React, { useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface BucketExplorerProps {
  onBucketSelect: (bucketName: string) => void
}

const BucketExplorer: React.FC<BucketExplorerProps> = ({ onBucketSelect }) => {
  const [newBucketName, setNewBucketName] = useState('')
  const [deletingBucket, setDeletingBucket] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const {
    data: buckets,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['buckets'],
    queryFn: () => window.api.listBuckets(),
  })

  const createBucketMutation = useMutation({
    mutationFn: (bucketName: string) => window.api.createBucket(bucketName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buckets'] })
      setNewBucketName('')
    },
  })

  const deleteBucketMutation = useMutation({
    mutationFn: (bucketName: string) => window.api.deleteBucket(bucketName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buckets'] })
      setDeletingBucket(null)
    },
    onError: () => {
      setDeletingBucket(null)
    },
  })

  const handleCreateBucket = (e: React.FormEvent) => {
    e.preventDefault()
    if (newBucketName.trim()) {
      createBucketMutation.mutate(newBucketName.trim())
    }
  }

  const handleDeleteBucket = (bucketName: string) => {
    if (window.confirm(`Are you sure you want to delete bucket "${bucketName}"?`)) {
      setDeletingBucket(bucketName)
      deleteBucketMutation.mutate(bucketName)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading buckets...</p>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error?.message || 'Failed to load buckets'}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create New Bucket</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateBucket} className="flex gap-3">
            <Input
              type="text"
              value={newBucketName}
              onChange={e => setNewBucketName(e.target.value)}
              placeholder="Enter bucket name"
              disabled={createBucketMutation.isPending}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={!newBucketName.trim() || createBucketMutation.isPending}
            >
              {createBucketMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  Creating...
                </>
              ) : (
                'Create Bucket'
              )}
            </Button>
          </form>
          {createBucketMutation.isError && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>
                {createBucketMutation.error?.message || 'Failed to create bucket'}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Buckets</CardTitle>
          <p className="text-sm text-muted-foreground">
            {buckets?.length || 0} bucket{buckets?.length !== 1 ? 's' : ''}
          </p>
        </CardHeader>
        <CardContent>
          {buckets && buckets.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bucket Name</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buckets.map((bucket: Bucket) => (
                  <TableRow key={bucket.Name}>
                    <TableCell
                      className="cursor-pointer hover:text-primary"
                      onClick={() => onBucketSelect(bucket.Name!)}
                    >
                      <div className="font-medium">{bucket.Name}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {bucket.CreationDate && new Date(bucket.CreationDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        onClick={() => handleDeleteBucket(bucket.Name!)}
                        disabled={deletingBucket === bucket.Name}
                        variant="destructive"
                        size="sm"
                      >
                        {deletingBucket === bucket.Name ? 'Deleting...' : 'Delete'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <svg
                className="mx-auto h-12 w-12 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium">No buckets</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Get started by creating a new bucket.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      {deleteBucketMutation.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {deleteBucketMutation.error?.message || 'Failed to delete bucket'}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

export default BucketExplorer
