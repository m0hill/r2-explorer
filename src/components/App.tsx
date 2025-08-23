import React, { useState } from 'react'
import type { ConnectionDisplay } from '../preload'
import ConnectionManager from './ConnectionManager'

const App: React.FC = () => {
  const [connections, setConnections] = useState<ConnectionDisplay[]>([])
  const [activeConnectionId, setActiveConnectionId] = useState<number | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  const handleConnectionSuccess = (connectionId: number) => {
    setActiveConnectionId(connectionId)
    setIsConnected(true)
  }

  const handleConnectionsUpdate = (updatedConnections: ConnectionDisplay[]) => {
    setConnections(updatedConnections)
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ConnectionManager
          connections={connections}
          onConnectionSuccess={handleConnectionSuccess}
          onConnectionsUpdate={handleConnectionsUpdate}
        />
      </div>
    )
  }

  const activeConnection = connections.find(conn => conn.id === activeConnectionId)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">R2 Explorer</h1>
              {activeConnection && (
                <p className="text-sm text-gray-500 mt-1">
                  Connected to: {activeConnection.name} ({activeConnection.accountId})
                </p>
              )}
            </div>
            <button
              onClick={() => {
                setIsConnected(false)
                setActiveConnectionId(null)
              }}
              className="bg-gray-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-600 transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Successfully Connected!</h2>
          <p className="text-gray-600">
            Connection to R2 established. The bucket browser interface will be implemented in Part
            2.
          </p>
        </div>
      </div>
    </div>
  )
}

export default App
