import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import type { ConnectionDisplay } from '../preload'
import BucketExplorer from './BucketExplorer'
import ConnectionManager from './ConnectionManager'
import ObjectExplorer from './ObjectExplorer'

const App: React.FC = () => {
  const [activeConnection, setActiveConnection] = useState<ConnectionDisplay | null>(null)
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null)

  const handleConnectionSuccess = (connection: ConnectionDisplay) => {
    setActiveConnection(connection)
    setSelectedBucket(null)
  }

  if (!activeConnection) {
    return (
      <div className="min-h-screen bg-background">
        <ConnectionManager onConnectionSuccess={handleConnectionSuccess} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Card className="rounded-none border-0 border-b">
        <CardHeader className="pb-4">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl">R2 Explorer</CardTitle>
              {activeConnection && (
                <p className="text-sm text-muted-foreground mt-1">
                  Connected to: {activeConnection.name} ({activeConnection.accountId})
                </p>
              )}
            </div>
            <Button
              variant="destructive"
              onClick={() => {
                setActiveConnection(null)
              }}
            >
              Disconnect
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="container mx-auto px-4 py-8">
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
