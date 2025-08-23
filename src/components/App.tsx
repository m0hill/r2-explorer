import { useQuery } from '@tanstack/react-query'
import React, { useState } from 'react'
import BucketExplorer from './BucketExplorer'
import ConnectionManager from './ConnectionManager'

const App: React.FC = () => {
  const [activeConnectionId, setActiveConnectionId] = useState<number | null>(null)

  const { data: connections } = useQuery({
    queryKey: ['connections'],
    queryFn: () => window.api.getConnections(),
    enabled: !!activeConnectionId,
  })

  const handleConnectionSuccess = (connectionId: number) => {
    setActiveConnectionId(connectionId)
  }

  if (!activeConnectionId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ConnectionManager onConnectionSuccess={handleConnectionSuccess} />
      </div>
    )
  }

  const activeConnection = connections?.find(conn => conn.id === activeConnectionId)

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
        <BucketExplorer />
      </div>
    </div>
  )
}

export default App
