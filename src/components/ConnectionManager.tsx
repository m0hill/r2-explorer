import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import React, { useState } from 'react'
import type { AddConnectionData } from '../preload'

interface ConnectionManagerProps {
  onConnectionSuccess: (connection: import('../preload').ConnectionDisplay) => void
}

const ConnectionManager: React.FC<ConnectionManagerProps> = ({ onConnectionSuccess }) => {
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<AddConnectionData>({
    name: '',
    accountId: '',
    accessKeyId: '',
    secretAccessKey: '',
  })

  const queryClient = useQueryClient()

  const {
    data: connections,
    isLoading: connectionsLoading,
    error: connectionsError,
  } = useQuery({
    queryKey: ['connections'],
    queryFn: () => window.api.getConnections(),
  })

  const addConnectionMutation = useMutation({
    mutationFn: (data: AddConnectionData) => window.api.addConnection(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] })
      setFormData({ name: '', accountId: '', accessKeyId: '', secretAccessKey: '' })
      setShowForm(false)
    },
  })

  const deleteConnectionMutation = useMutation({
    mutationFn: (id: number) => window.api.deleteConnection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] })
    },
  })

  const connectMutation = useMutation({
    mutationFn: (id: number) => window.api.connectToR2(id),
    onSuccess: (result, id) => {
      if (result.success) {
        const connection = connections?.find(conn => conn.id === id)
        if (connection) {
          onConnectionSuccess(connection)
        }
      }
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    addConnectionMutation.mutate(formData)
  }

  const handleConnect = (id: number) => {
    connectMutation.mutate(id)
  }

  const handleDelete = (id: number) => {
    if (!window.confirm('Are you sure you want to delete this connection?')) {
      return
    }
    deleteConnectionMutation.mutate(id)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-2xl font-bold text-gray-900">R2 Explorer - Connection Manager</h1>
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              {showForm ? 'Cancel' : 'Add Connection'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {connectionsError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="text-red-700 text-sm">
              {connectionsError?.message || 'Failed to load connections'}
            </div>
          </div>
        )}

        {addConnectionMutation.isError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="text-red-700 text-sm">
              {addConnectionMutation.error?.message || 'Failed to add connection'}
            </div>
          </div>
        )}

        {connectMutation.isError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="text-red-700 text-sm">
              {connectMutation.error?.message || 'Connection failed'}
            </div>
          </div>
        )}

        {deleteConnectionMutation.isError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="text-red-700 text-sm">
              {deleteConnectionMutation.error?.message || 'Failed to delete connection'}
            </div>
          </div>
        )}

        {showForm && (
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Add New Connection</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Connection Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="My R2 Connection"
                  />
                </div>

                <div>
                  <label htmlFor="accountId" className="block text-sm font-medium text-gray-700">
                    Account ID
                  </label>
                  <input
                    type="text"
                    id="accountId"
                    name="accountId"
                    value={formData.accountId}
                    onChange={handleInputChange}
                    required
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="your-account-id"
                  />
                </div>

                <div>
                  <label htmlFor="accessKeyId" className="block text-sm font-medium text-gray-700">
                    Access Key ID
                  </label>
                  <input
                    type="text"
                    id="accessKeyId"
                    name="accessKeyId"
                    value={formData.accessKeyId}
                    onChange={handleInputChange}
                    required
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label
                    htmlFor="secretAccessKey"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Secret Access Key
                  </label>
                  <input
                    type="password"
                    id="secretAccessKey"
                    name="secretAccessKey"
                    value={formData.secretAccessKey}
                    onChange={handleInputChange}
                    required
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addConnectionMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {addConnectionMutation.isPending ? 'Adding...' : 'Add Connection'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Saved Connections</h2>
          </div>

          {connectionsLoading ? (
            <div className="p-6 text-center text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              Loading connections...
            </div>
          ) : connections?.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No connections saved yet. Click "Add Connection" to get started.
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {connections?.map(connection => (
                <div key={connection.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{connection.name}</h3>
                      <p className="text-sm text-gray-500">Account ID: {connection.accountId}</p>
                      <p className="text-sm text-gray-500">Access Key: {connection.accessKeyId}</p>
                    </div>
                    <div className="flex space-x-3">
                      <button
                        onClick={() => handleConnect(connection.id)}
                        disabled={connectMutation.isPending || deleteConnectionMutation.isPending}
                        className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {connectMutation.isPending ? 'Connecting...' : 'Connect'}
                      </button>
                      <button
                        onClick={() => handleDelete(connection.id)}
                        disabled={connectMutation.isPending || deleteConnectionMutation.isPending}
                        className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        {deleteConnectionMutation.isPending ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ConnectionManager
