import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import React, { useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AddConnectionData, ConnectionDisplay } from '../preload'

interface ConnectionManagerProps {
  onConnectionSuccess: (connection: import('../preload').ConnectionDisplay) => void
}

const ConnectionManager: React.FC<ConnectionManagerProps> = ({ onConnectionSuccess }) => {
  const [showForm, setShowForm] = useState(false)
  const [editingConnection, setEditingConnection] = useState<ConnectionDisplay | null>(null)
  const [formData, setFormData] = useState<AddConnectionData>({
    name: '',
    accountId: '',
    accessKeyId: '',
    secretAccessKey: '',
    apiToken: '',
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
      resetForm()
    },
  })

  const updateConnectionMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: AddConnectionData }) =>
      window.api.updateConnection(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] })
      resetForm()
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
    if (editingConnection) {
      updateConnectionMutation.mutate({ id: editingConnection.id, data: formData })
    } else {
      addConnectionMutation.mutate(formData)
    }
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

  const resetForm = () => {
    setFormData({ name: '', accountId: '', accessKeyId: '', secretAccessKey: '', apiToken: '' })
    setShowForm(false)
    setEditingConnection(null)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleEdit = (connection: ConnectionDisplay) => {
    setEditingConnection(connection)
    setFormData({
      name: connection.name,
      accountId: connection.accountId,
      accessKeyId: connection.accessKeyId,
      secretAccessKey: '', // Don't populate for security
      apiToken: '', // Don't populate for security
    })
    setShowForm(true)
  }

  return (
    <div className="min-h-screen bg-background">
      <Card className="rounded-none border-0 border-b">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl">R2 Explorer - Connection Manager</CardTitle>
            <Dialog open={showForm} onOpenChange={setShowForm}>
              <DialogTrigger asChild>
                <Button>Add Connection</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>
                    {editingConnection ? 'Edit Connection' : 'Add New Connection'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Connection Name</Label>
                      <Input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="My R2 Connection"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="accountId">Account ID</Label>
                      <Input
                        id="accountId"
                        name="accountId"
                        value={formData.accountId}
                        onChange={handleInputChange}
                        placeholder="your-account-id"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="accessKeyId">Access Key ID</Label>
                      <Input
                        id="accessKeyId"
                        name="accessKeyId"
                        value={formData.accessKeyId}
                        onChange={handleInputChange}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="secretAccessKey">Secret Access Key</Label>
                      <Input
                        id="secretAccessKey"
                        name="secretAccessKey"
                        type="password"
                        value={formData.secretAccessKey}
                        onChange={handleInputChange}
                        placeholder={editingConnection ? 'Re-enter for security' : ''}
                        required
                      />
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="apiToken">Cloudflare API Token (optional)</Label>
                      <Input
                        id="apiToken"
                        name="apiToken"
                        type="password"
                        value={formData.apiToken ?? ''}
                        onChange={handleInputChange}
                        placeholder={
                          editingConnection
                            ? 'Re-enter for security (optional)'
                            : 'Used to provision share Worker automatically'
                        }
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button type="button" variant="outline" onClick={resetForm}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={
                        addConnectionMutation.isPending || updateConnectionMutation.isPending
                      }
                    >
                      {addConnectionMutation.isPending || updateConnectionMutation.isPending
                        ? editingConnection
                          ? 'Updating...'
                          : 'Adding...'
                        : editingConnection
                          ? 'Update Connection'
                          : 'Add Connection'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      <div className="container mx-auto px-4 py-8 space-y-6">
        {connectionsError && (
          <Alert variant="destructive">
            <AlertDescription>
              {connectionsError?.message || 'Failed to load connections'}
            </AlertDescription>
          </Alert>
        )}

        {addConnectionMutation.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              {addConnectionMutation.error?.message || 'Failed to add connection'}
            </AlertDescription>
          </Alert>
        )}

        {updateConnectionMutation.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              {updateConnectionMutation.error?.message || 'Failed to update connection'}
            </AlertDescription>
          </Alert>
        )}

        {connectMutation.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              {connectMutation.error?.message || 'Connection failed'}
            </AlertDescription>
          </Alert>
        )}

        {deleteConnectionMutation.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              {deleteConnectionMutation.error?.message || 'Failed to delete connection'}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Saved Connections</CardTitle>
          </CardHeader>
          <CardContent>
            {connectionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-muted-foreground">Loading connections...</p>
                </div>
              </div>
            ) : connections?.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  No connections saved yet. Click "Add Connection" to get started.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {connections?.map(connection => (
                  <div
                    key={connection.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="space-y-1">
                      <h3 className="font-medium">{connection.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Account ID: {connection.accountId}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Access Key: {connection.accessKeyId}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => handleConnect(connection.id)}
                        disabled={connectMutation.isPending || deleteConnectionMutation.isPending}
                        variant="default"
                      >
                        {connectMutation.isPending ? 'Connecting...' : 'Connect'}
                      </Button>
                      <Button
                        onClick={() => handleEdit(connection)}
                        disabled={connectMutation.isPending || deleteConnectionMutation.isPending}
                        variant="outline"
                      >
                        Edit
                      </Button>
                      <Button
                        onClick={() => handleDelete(connection.id)}
                        disabled={connectMutation.isPending || deleteConnectionMutation.isPending}
                        variant="destructive"
                      >
                        {deleteConnectionMutation.isPending ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default ConnectionManager
