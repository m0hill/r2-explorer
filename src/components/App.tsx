import React, { useState } from 'react'
import type { ConnectionDisplay } from '../preload'
import BucketExplorer from './BucketExplorer'
import ConnectionManager from './ConnectionManager'
import ObjectExplorer from './ObjectExplorer'

const App: React.FC = () => {
  const [activeConnection, setActiveConnection] = useState<ConnectionDisplay | null>(null)
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null)

  const handleConnectionSuccess = (connectionId: number) => {
    // Fetch the connection details to store the full object
    window.api.getConnections().then(connections => {
      const connection = connections.find(conn => conn.id === connectionId)
      if (connection) {
        setActiveConnection(connection)
        setSelectedBucket(null)
      }
    })
  }

  if (!activeConnection) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ConnectionManager onConnectionSuccess={handleConnectionSuccess} />
      </div>
    )
  }

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
                setActiveConnection(null)
              }}
              className="bg-gray-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-600 transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {selectedBucket ? (
          <ObjectExplorer bucketName={selectedBucket} onBack={() => setSelectedBucket(null)} />
        ) : (
          <BucketExplorer onBucketSelect={setSelectedBucket} />
        )}
      </div>
    </div>
  )
}

export default App
