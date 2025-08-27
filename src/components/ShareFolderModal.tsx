import { useMutation, useQueryClient } from '@tanstack/react-query'
import React, { useState } from 'react'

const EXPIRATION_OPTIONS = [
  { label: '1 Hour', value: 3600 },
  { label: '1 Day', value: 86400 },
  { label: '7 Days', value: 604800 },
]

interface ShareFolderModalProps {
  isOpen: boolean
  onClose: () => void
  bucketName: string
  folderPrefix: string
}

const ShareFolderModal: React.FC<ShareFolderModalProps> = ({
  isOpen,
  onClose,
  bucketName,
  folderPrefix,
}) => {
  const qc = useQueryClient()

  const [selectedExpiration, setSelectedExpiration] = useState(3600)
  const [pin, setPin] = useState('')
  const [copied, setCopied] = useState(false)

  const createMutation = useMutation({
    mutationFn: async () => {
      // Ensure worker implicitly via backend handler
      const result = await window.api.createFolderShare({
        bucketName,
        prefix: folderPrefix,
        expiresIn: selectedExpiration,
        pin: pin.trim() || undefined,
      })
      return result
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folder-shares'] })
    },
  })

  if (!isOpen) return null

  const onCopy = async (url: string) => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const validPin = pin.length === 0 || /^[0-9]{4}$/.test(pin)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full m-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Share Folder</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
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
          <p className="text-sm text-gray-500 mt-1 break-all">{folderPrefix}</p>
        </div>

        <div className="px-6 py-4 space-y-4">
          {createMutation.isSuccess ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Share Link</label>
                <div className="bg-gray-50 rounded-md p-3 break-all text-sm font-mono">
                  {createMutation.data.url}
                </div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <p className="text-sm text-yellow-800">
                  You can revoke this share anytime from the "Active Shares" list. Only share with
                  trusted parties.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onCopy(createMutation.data.url)}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          ) : (
            <>
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Optional 4-digit PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  placeholder="e.g. 1234"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                {!validPin && <p className="text-xs text-red-600 mt-1">PIN must be 4 digits</p>}
              </div>

              {createMutation.isError && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
                  {(createMutation.error as Error).message || 'Failed to create link'}
                </div>
              )}

              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <p className="text-sm text-yellow-800">
                  You can revoke shares later from the "Active Shares" list. Only share with trusted
                  parties.
                </p>
              </div>

              <button
                type="button"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !validPin}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Share Link'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ShareFolderModal
