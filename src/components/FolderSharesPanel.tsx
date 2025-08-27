import type { Bucket } from '@aws-sdk/client-s3'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import React from 'react'
import type { FolderShareRecord, FolderShareResult } from '../preload'
import CopyButton from './CopyButton'

type Unit = 'minutes' | 'hours' | 'days'

function toSeconds(value: number, unit: Unit) {
  if (!Number.isFinite(value) || value <= 0) return 3600
  switch (unit) {
    case 'minutes':
      return Math.round(value * 60)
    case 'hours':
      return Math.round(value * 60 * 60)
    case 'days':
      return Math.round(value * 24 * 60 * 60)
  }
}

function formatRelative(ts: string) {
  const now = Date.now()
  const then = new Date(ts).getTime()
  const diffMs = then - now
  if (!Number.isFinite(then)) return ts
  if (diffMs <= 0) return 'expired'
  const mins = Math.round(diffMs / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours}h`
  const days = Math.round(hours / 24)
  return `${days}d`
}

export default function FolderSharesPanel() {
  const qc = useQueryClient()
  const [ensureMsg, setEnsureMsg] = React.useState<string | null>(null)

  // Buckets for a nicer create form
  const bucketsQ = useQuery({
    queryKey: ['buckets'],
    queryFn: async () => {
      const list = await window.api.listBuckets()
      return list ?? []
    },
  })

  const sharesQ = useQuery({
    queryKey: ['folder-shares'],
    queryFn: () => window.api.listFolderShares(),
  })

  const ensureWorkerM = useMutation({
    mutationFn: async () => {
      const r = await window.api.ensureShareWorker()
      return r.workerUrl
    },
    onSuccess: url => {
      setEnsureMsg(`Worker ready at ${url}`)
      setTimeout(() => setEnsureMsg(null), 3000)
    },
    onError: e => {
      setEnsureMsg(e instanceof Error ? e.message : 'Failed to ensure worker')
      setTimeout(() => setEnsureMsg(null), 4000)
    },
  })

  const revokeM = useMutation({
    mutationFn: async (id: number) => {
      await window.api.revokeFolderShare({ id })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folder-shares'] })
    },
    onError: e => {
      alert(`Failed to revoke: ${e instanceof Error ? e.message : 'Unknown'}`)
    },
  })

  const createM = useMutation({
    mutationFn: async (input: {
      bucketName: string
      prefix: string
      expiresInSec: number
      pin?: string
    }): Promise<FolderShareResult> => {
      const { bucketName, prefix, expiresInSec, pin } = input
      return window.api.createFolderShare({
        bucketName,
        prefix,
        expiresIn: expiresInSec,
        pin,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folder-shares'] })
    },
    onError: e => {
      alert(`Failed to create share: ${e instanceof Error ? e.message : 'Unknown'}`)
    },
  })

  // Create form state
  const [bucketName, setBucketName] = React.useState('')
  const [prefix, setPrefix] = React.useState('')
  const [expiryVal, setExpiryVal] = React.useState<number>(1)
  const [expiryUnit, setExpiryUnit] = React.useState<Unit>('days')
  const [pin, setPin] = React.useState('')

  const canCreate = bucketName.trim().length > 0 && prefix.trim().length > 0

  const onCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canCreate) return
    const expiresInSec = toSeconds(expiryVal, expiryUnit)
    const cleanPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`
    const pinUse = pin.trim().length > 0 ? pin.trim() : undefined

    createM.mutate({
      bucketName: bucketName.trim(),
      prefix: cleanPrefix,
      expiresInSec,
      pin: pinUse,
    })
  }

  const onUseBucket = (b: Bucket) => {
    if (b.Name) setBucketName(b.Name)
  }

  return (
    <div className="space-y-8">
      <div className="rounded border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Folder Shares</h2>
          <div className="flex items-center gap-2">
            <button
              className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
              onClick={() => sharesQ.refetch()}
              disabled={sharesQ.isFetching}
            >
              {sharesQ.isFetching ? 'Refreshing…' : 'Refresh'}
            </button>
            <button
              className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
              onClick={() => ensureWorkerM.mutate()}
              disabled={ensureWorkerM.isPending}
              title="Provision/verify the Cloudflare Worker"
            >
              {ensureWorkerM.isPending ? 'Ensuring…' : 'Ensure Worker'}
            </button>
          </div>
        </div>
        {ensureMsg ? <div className="mb-4 text-sm text-gray-600">{ensureMsg}</div> : null}

        <form onSubmit={onCreate} className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Bucket</label>
            <div className="flex">
              <input
                className="w-full rounded border px-3 py-2"
                placeholder="my-bucket"
                value={bucketName}
                onChange={e => setBucketName(e.target.value)}
                list="bucket-list"
              />
            </div>
            <datalist id="bucket-list">
              {(bucketsQ.data ?? []).map(b =>
                b.Name ? <option key={b.Name} value={b.Name} /> : null
              )}
            </datalist>
            <div className="mt-1 text-xs text-gray-500">Or pick below:</div>
            <div className="mt-1 flex flex-wrap gap-2">
              {(bucketsQ.data ?? []).map(b =>
                b.Name ? (
                  <button
                    type="button"
                    key={b.Name}
                    className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                    onClick={() => onUseBucket(b)}
                  >
                    {b.Name}
                  </button>
                ) : null
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Prefix (folder path)</label>
            <input
              className="w-full rounded border px-3 py-2"
              placeholder="photos/2025/"
              value={prefix}
              onChange={e => setPrefix(e.target.value)}
            />
            <div className="mt-1 text-xs text-gray-500">Will be normalized to end with "/"</div>
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium">Expires in</label>
              <input
                type="number"
                min={1}
                className="w-full rounded border px-3 py-2"
                value={expiryVal}
                onChange={e => {
                  const v = Number(e.target.value)
                  setExpiryVal(Number.isFinite(v) ? v : 1)
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Unit</label>
              <select
                className="rounded border px-2 py-2"
                value={expiryUnit}
                onChange={e => setExpiryUnit(e.target.value as Unit)}
              >
                <option value="minutes">minutes</option>
                <option value="hours">hours</option>
                <option value="days">days</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">4-digit PIN (optional)</label>
            <input
              className="w-full rounded border px-3 py-2"
              placeholder="e.g. 1234"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pin}
              onChange={e => setPin(e.target.value)}
              maxLength={4}
            />
            <div className="mt-1 text-xs text-gray-500">Leave empty for no PIN</div>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={!canCreate || createM.isPending}
              className="rounded border bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {createM.isPending ? 'Creating…' : 'Create Share'}
            </button>
          </div>
        </form>
      </div>

      <SharesList
        isLoading={sharesQ.isLoading}
        data={sharesQ.data ?? []}
        onRevoke={id => revokeM.mutate(id)}
        isRevoking={revokeM.isPending}
      />
    </div>
  )
}

function SharesList(props: {
  isLoading: boolean
  data: FolderShareRecord[]
  onRevoke: (id: number) => void
  isRevoking: boolean
}) {
  const { isLoading, data, onRevoke, isRevoking } = props

  if (isLoading) {
    return <div className="text-sm text-gray-600">Loading…</div>
  }

  if (!data.length) {
    return <div className="rounded border p-4 text-sm text-gray-600">No active shares.</div>
  }

  return (
    <div className="overflow-x-auto rounded border">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="px-3 py-2 font-medium">Bucket</th>
            <th className="px-3 py-2 font-medium">Prefix</th>
            <th className="px-3 py-2 font-medium">URL</th>
            <th className="px-3 py-2 font-medium">Expires</th>
            <th className="px-3 py-2 font-medium">PIN</th>
            <th className="px-3 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr key={row.id}>
              <td className="px-3 py-2">{row.bucketName}</td>
              <td className="px-3 py-2 font-mono">{row.prefix}</td>
              <td className="px-3 py-2">
                <div className="max-w-[380px] truncate align-middle">
                  <a
                    href={row.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {row.url}
                  </a>
                  <CopyButton text={row.url} />
                </div>
              </td>
              <td className="px-3 py-2">
                <div title={row.expiresAt}>{formatRelative(row.expiresAt)}</div>
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
                  className="rounded border px-3 py-1 hover:bg-gray-50"
                  onClick={() => onRevoke(row.id)}
                  disabled={isRevoking}
                  title="Revoke and remove this share"
                >
                  {isRevoking ? 'Revoking…' : 'Revoke'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
