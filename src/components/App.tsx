import React, { useState } from 'react'
import type { ConnectionDisplay } from '../preload'
import BucketExplorer from './BucketExplorer'
import ConnectionManager from './ConnectionManager'
import FolderSharesPanel from './FolderSharesPanel'
import ObjectExplorer from './ObjectExplorer'

const App: React.FC = () => {
  const [activeConnection, setActiveConnection] = useState<ConnectionDisplay | null>(null)
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<'buckets' | 'shares'>('buckets')

  const handleConnectionSuccess = (connection: ConnectionDisplay) => {
    setActiveConnection(connection)
    setSelectedBucket(null)
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
        {/* Navigation Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => {
                setActiveView('buckets')
                setSelectedBucket(null)
              }}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeView === 'buckets'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Buckets & Objects
            </button>
            <button
              onClick={() => {
                setActiveView('shares')
                setSelectedBucket(null)
              }}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeView === 'shares'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Folder Shares
            </button>
          </nav>
        </div>

        {/* Content */}
        {activeView === 'buckets' ? (
          selectedBucket ? (
            <ObjectExplorer bucketName={selectedBucket} onBack={() => setSelectedBucket(null)} />
          ) : (
            <BucketExplorer onBucketSelect={setSelectedBucket} />
          )
        ) : (
          <FolderSharesPanel />
        )}
      </div>
    </div>
  )
}

export default App
