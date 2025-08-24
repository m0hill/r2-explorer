import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import React, { useState } from 'react'

interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  bucketName: string
  objectKey: string
}

const EXPIRATION_OPTIONS = [
  { label: '1 Hour', value: 3600 },
  { label: '1 Day', value: 86400 },
  { label: '7 Days', value: 604800 },
]

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, bucketName, objectKey }) => {
  const [selectedExpiration, setSelectedExpiration] = useState(3600)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const queryClient = useQueryClient()

  const { data: existingUrl, isLoading } = useQuery({
    queryKey: ['presignedUrl', bucketName, objectKey],
    queryFn: () => window.api.getPresignedUrl({ bucketName, key: objectKey }),
    enabled: isOpen,
  })

  const createMutation = useMutation({
    mutationFn: () =>
      window.api.createPresignedUrl({
        bucketName,
        key: objectKey,
        expiresIn: selectedExpiration,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presignedUrl', bucketName, objectKey] })
    },
    onError: error => {
      alert(`Failed to create share link: ${error.message}`)
    },
  })

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    } catch (error) {
      console.error('Failed to copy URL:', error)
    }
  }

  const formatExpirationDate = (expiresAt: string) => {
    const date = new Date(expiresAt)
    return date.toLocaleString()
  }

  const getExpirationLabel = (expiresAt: string) => {
    const now = new Date()
    const expires = new Date(expiresAt)
    const diffMs = expires.getTime() - now.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''}`
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''}`
    } else {
      return 'Less than 1 hour'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full m-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Share Object</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 focus:outline-none"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1 break-all">{objectKey}</p>
        </div>

        <div className="px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : existingUrl ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Share Link
                </label>
                <div className="bg-gray-50 rounded-md p-3 break-all text-sm font-mono">
                  {existingUrl.url}
                </div>
              </div>

              <div className="bg-blue-50 rounded-md p-3">
                <div className="flex items-center">
                  <svg
                    className="h-5 w-5 text-blue-400 mr-2"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 001.414-1.415L11 9.586V6z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <p className="text-sm text-blue-800">
                      Expires in {getExpirationLabel(existingUrl.expiresAt)}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      {formatExpirationDate(existingUrl.expiresAt)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
                <div className="flex">
                  <svg
                    className="h-5 w-5 text-yellow-400 mr-2 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <h3 className="text-sm font-medium text-yellow-800">Important</h3>
                    <p className="mt-1 text-sm text-yellow-700">
                      Share links cannot be revoked once created. Only share with trusted parties.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleCopyUrl(existingUrl.url)}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {copiedUrl ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Link Expiration
                </label>
                <div className="space-y-2">
                  {EXPIRATION_OPTIONS.map(option => (
                    <label key={option.value} className="flex items-center">
                      <input
                        type="radio"
                        name="expiration"
                        value={option.value}
                        checked={selectedExpiration === option.value}
                        onChange={e => setSelectedExpiration(Number(e.target.value))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <span className="ml-2 text-sm text-gray-700">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <div className="flex">
                  <svg
                    className="h-5 w-5 text-yellow-400 mr-2 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <h3 className="text-sm font-medium text-yellow-800">Important</h3>
                    <p className="mt-1 text-sm text-yellow-700">
                      Share links cannot be revoked once created. Only share with trusted parties.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {createMutation.isPending ? (
                  <>
                    <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Creating Link...
                  </>
                ) : (
                  'Create Share Link'
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ShareModal
