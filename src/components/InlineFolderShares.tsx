import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import React from 'react'
import type { FolderShareRecord } from '@/preload'

function formatRelative(ts: string) {
  const now = Date.now()
  const then = new Date(ts).getTime()
  if (!Number.isFinite(then)) return ts
  const diffMs = then - now
  if (diffMs <= 0) return 'expired'
  const mins = Math.round(diffMs / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours}h`
  const days = Math.round(hours / 24)
  return `${days}d`
}

type Props = {
  bucketName: string
  currentPrefix: string
  onShareCurrent?: () => void
}

export default function InlineFolderShares({ bucketName, currentPrefix, onShareCurrent }: Props) {
  const qc = useQueryClient()

  const sharesQ = useQuery({
    queryKey: ['folder-shares'],
    queryFn: () => window.api.listFolderShares(),
  })

  const revokeM = useMutation({
    mutationFn: async (id: number) => {
      await window.api.revokeFolderShare({ id })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folder-shares'] })
    },
    onError: e => {
      alert(`Failed to revoke: ${e instanceof Error ? e.message : 'Unknown error'}`)
    },
  })

  const [scope, setScope] = React.useState<'exact' | 'below'>('below')

  const rows = (sharesQ.data ?? [])
    .filter(s => s.bucketName === bucketName)
    .filter(s =>
      scope === 'exact' ? s.prefix === currentPrefix : s.prefix.startsWith(currentPrefix)
    )
    // most recent first
    .sort((a, b) => b.id - a.id)

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      alert('Failed to copy URL')
    }
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-gray-900">Active Shares</h3>
          <div className="text-sm text-gray-600">
            Scope:
            <select
              className="ml-2 rounded border px-2 py-1 text-sm"
              value={scope}
              onChange={e => setScope(e.target.value as 'exact' | 'below')}
            >
              <option value="exact">this folder</option>
              <option value="below">this folder and below</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => sharesQ.refetch()}
            disabled={sharesQ.isFetching}
            className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
          >
            {sharesQ.isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            onClick={onShareCurrent}
            disabled={!onShareCurrent || currentPrefix === ''}
            title={currentPrefix === '' ? 'Open a folder to share it' : 'Share this folder'}
            className="rounded border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Share This Folder
          </button>
        </div>
      </div>

      {sharesQ.isLoading ? (
        <div className="p-6 text-sm text-gray-600">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="p-6 text-sm text-gray-600">No shares found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Prefix</th>
                <th className="px-3 py-2 font-medium">URL</th>
                <th className="px-3 py-2 font-medium">Expires</th>
                <th className="px-3 py-2 font-medium">PIN</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: FolderShareRecord) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2 font-mono">{row.prefix}</td>
                  <td className="px-3 py-2">
                    <div className="max-w-[380px] truncate">
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                        title={row.url}
                      >
                        {row.url}
                      </a>
                      <button
                        className="ml-2 inline-flex items-center rounded border px-2 py-1 text-xs hover:bg-gray-50"
                        onClick={() => copy(row.url)}
                        title="Copy to clipboard"
                      >
                        Copy
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2" title={row.expiresAt}>
                    {formatRelative(row.expiresAt)}
                  </td>
                  <td className="px-3 py-2">
                    {row.hasPin ? (
                      <span className="rounded bg-gray-200 px-2 py-1 text-xs">yes</span>
                    ) : (
                      <span className="rounded bg-gray-100 px-2 py-1 text-xs">no</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => revokeM.mutate(row.id)}
                      disabled={revokeM.isPending}
                      className="rounded border px-3 py-1 hover:bg-gray-50"
                      title="Revoke and remove this share"
                    >
                      {revokeM.isPending ? 'Revoking…' : 'Revoke'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
