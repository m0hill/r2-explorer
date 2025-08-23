import type { Bucket } from '@aws-sdk/client-s3'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import React, { useState } from 'react'

const BucketExplorer: React.FC = () => {
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading buckets...</p>
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
            <h3 className="text-sm font-medium text-red-800">Error loading buckets</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error?.message || 'Failed to load buckets'}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Bucket</h2>
        <form onSubmit={handleCreateBucket} className="flex gap-3">
          <input
            type="text"
            value={newBucketName}
            onChange={e => setNewBucketName(e.target.value)}
            placeholder="Enter bucket name"
            className="flex-1 min-w-0 rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={createBucketMutation.isPending}
          />
          <button
            type="submit"
            disabled={!newBucketName.trim() || createBucketMutation.isPending}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createBucketMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating...
              </>
            ) : (
              'Create Bucket'
            )}
          </button>
        </form>
        {createBucketMutation.isError && (
          <p className="mt-2 text-sm text-red-600">
            {createBucketMutation.error?.message || 'Failed to create bucket'}
          </p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Your Buckets</h2>
          <p className="text-sm text-gray-500 mt-1">
            {buckets?.length || 0} bucket{buckets?.length !== 1 ? 's' : ''}
          </p>
        </div>
        {buckets && buckets.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {buckets.map((bucket: Bucket) => (
              <div key={bucket.Name} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">{bucket.Name}</h3>
                  {bucket.CreationDate && (
                    <p className="text-sm text-gray-500">
                      Created {new Date(bucket.CreationDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteBucket(bucket.Name!)}
                  disabled={deletingBucket === bucket.Name}
                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deletingBucket === bucket.Name ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-8 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
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
            <h3 className="mt-2 text-sm font-medium text-gray-900">No buckets</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new bucket.</p>
          </div>
        )}
      </div>
      {deleteBucketMutation.isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-600">
            {deleteBucketMutation.error?.message || 'Failed to delete bucket'}
          </p>
        </div>
      )}
    </div>
  )
}

export default BucketExplorer
