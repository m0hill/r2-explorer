import React, { useEffect, useState } from 'react'
import type { AddConnectionData, ConnectionDisplay } from '../preload'

interface ConnectionManagerProps {
  connections: ConnectionDisplay[]
  onConnectionSuccess: (connectionId: number) => void
  onConnectionsUpdate: (connections: ConnectionDisplay[]) => void
}

const ConnectionManager: React.FC<ConnectionManagerProps> = ({
  connections,
  onConnectionSuccess,
  onConnectionsUpdate,
}) => {
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<AddConnectionData>({
    name: '',
    accountId: '',
    accessKeyId: '',
    secretAccessKey: '',
  })

  const fetchConnections = async () => {
    try {
      const fetchedConnections = await window.api.getConnections()
      onConnectionsUpdate(fetchedConnections)
    } catch (err) {
      setError('Failed to load connections')
      console.error('Error fetching connections:', err)
    }
  }

  useEffect(() => {
    fetchConnections()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await window.api.addConnection(formData)
      setFormData({ name: '', accountId: '', accessKeyId: '', secretAccessKey: '' })
      setShowForm(false)
      await fetchConnections()
    } catch (err) {
      setError('Failed to add connection')
      console.error('Error adding connection:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async (id: number) => {
    setLoading(true)
    setError(null)

    try {
      const result = await window.api.connectToR2(id)
      if (result.success) {
        onConnectionSuccess(id)
      } else {
        setError(result.error || 'Connection failed')
      }
    } catch (err) {
      setError('Connection failed')
      console.error('Error connecting:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this connection?')) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      await window.api.deleteConnection(id)
      await fetchConnections()
    } catch (err) {
      setError('Failed to delete connection')
      console.error('Error deleting connection:', err)
    } finally {
      setLoading(false)
    }
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
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="text-red-700 text-sm">{error}</div>
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
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Adding...' : 'Add Connection'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Saved Connections</h2>
          </div>

          {connections.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No connections saved yet. Click "Add Connection" to get started.
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {connections.map(connection => (
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
                        disabled={loading}
                        className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {loading ? 'Connecting...' : 'Connect'}
                      </button>
                      <button
                        onClick={() => handleDelete(connection.id)}
                        disabled={loading}
                        className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        Delete
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
