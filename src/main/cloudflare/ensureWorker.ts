import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { Effect } from 'effect'
import { safeStorage } from 'electron'
import { db } from '@/main/db'
import { connections } from '@/main/db/schema'

type CfJson<T = unknown> = {
  success: boolean
  result?: T
  errors?: unknown[]
  messages?: unknown[]
}

function base64url(input: Buffer) {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function deriveAdminToken(accessKeyId: string, secretAccessKey: string, id: number) {
  const h = crypto.createHash('sha256')
  h.update(`${accessKeyId}:${secretAccessKey}:r2-explorer:${id}`)
  return base64url(h.digest())
}

async function cfFetch<T = unknown>(
  accountId: string,
  apiToken: string,
  method: string,
  pathFrag: string,
  init?: RequestInit
): Promise<CfJson<T>> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/${pathFrag}`
  const resp = await fetch(url, {
    ...init,
    method,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      ...(init?.headers || {}),
    },
  })
  const text = await resp.text()
  let json: CfJson<T>
  try {
    json = JSON.parse(text) as CfJson<T>
  } catch {
    throw new Error(`Cloudflare API response not JSON (${resp.status}): ${text.slice(0, 200)}`)
  }
  if (!resp.ok || !json.success) {
    throw new Error(
      `Cloudflare API error ${resp.status} on ${pathFrag}: ${JSON.stringify(json.errors || text)}`
    )
  }
  return json
}

async function ensureKvNamespace(
  accountId: string,
  apiToken: string,
  title: string
): Promise<string> {
  const list = await cfFetch<{ id: string; title: string }[]>(
    accountId,
    apiToken,
    'GET',
    `storage/kv/namespaces?per_page=1000`
  )
  const existing = (list.result || []).find(n => n.title === title)
  if (existing) return existing.id
  const created = await cfFetch<{ id: string; title: string }>(
    accountId,
    apiToken,
    'POST',
    `storage/kv/namespaces`,
    {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title }),
    }
  )
  return created.result!.id
}

async function getWorkersSubdomain(accountId: string, apiToken: string): Promise<string> {
  const res = await cfFetch<{ subdomain: string }>(accountId, apiToken, 'GET', 'workers/subdomain')
  const sub = res.result?.subdomain
  if (!sub) throw new Error('No workers.dev subdomain returned by Cloudflare')
  return sub
}

async function uploadWorkerModule(opts: {
  accountId: string
  apiToken: string
  workerName: string
  code: string
  kvNamespaceId: string
  bindings: Record<string, string> // name -> value (plain_text)
}) {
  const metadata = {
    main_module: 'worker.mjs',
    compatibility_date: '2024-01-01',
    // enable on workers.dev
    workers_dev: true,
    // We don't use Node APIs; no need for nodejs_compat here.
    bindings: [
      { type: 'kv_namespace', name: 'SHARES', namespace_id: opts.kvNamespaceId },
      ...Object.entries(opts.bindings).map(([name, text]) => ({
        type: 'plain_text' as const,
        name,
        text,
      })),
    ],
  }

  const form = new FormData()
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' }),
    'metadata'
  )
  // IMPORTANT: for module workers the field name must match metadata.main_module
  form.append(
    'worker.mjs',
    new Blob([opts.code], { type: 'application/javascript+module' }),
    'worker.mjs'
  )

  // PUT module worker (scripts API, modules upload)
  const url = `workers/scripts/${encodeURIComponent(opts.workerName)}`
  const resp = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${opts.accountId}/${url}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${opts.apiToken}` },
      body: form,
    }
  )
  const text = await resp.text()
  let json: CfJson
  try {
    json = JSON.parse(text) as CfJson
  } catch {
    throw new Error(`Upload worker failed (${resp.status}): ${text.slice(0, 200)}`)
  }
  if (!resp.ok || !json.success) {
    throw new Error(`Upload worker failed ${resp.status}: ${JSON.stringify(json.errors || text)}`)
  }
}

async function getWorkerSubdomainStatus(
  accountId: string,
  apiToken: string,
  workerName: string
): Promise<{ enabled: boolean; previews_enabled?: boolean }> {
  const res = await cfFetch<{ enabled: boolean; previews_enabled?: boolean }>(
    accountId,
    apiToken,
    'GET',
    `workers/scripts/${encodeURIComponent(workerName)}/subdomain`
  )
  return res.result || { enabled: false }
}

async function enableWorkersSubdomain(
  accountId: string,
  apiToken: string,
  workerName: string,
  enabled: boolean
): Promise<void> {
  await cfFetch<{ enabled: boolean; previews_enabled?: boolean }>(
    accountId,
    apiToken,
    'POST',
    `workers/scripts/${encodeURIComponent(workerName)}/subdomain`,
    {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        enabled: enabled,
        previews_enabled: true,
      }),
    }
  )
}

export const ensureWorkerForConnection = (id: number) =>
  Effect.gen(function* () {
    const rows = yield* Effect.tryPromise(() =>
      db.select().from(connections).where(eq(connections.id, id)).limit(1)
    )
    if (!rows.length) {
      yield* Effect.fail(new Error('Connection not found'))
    }
    const row = rows[0]!

    if (!safeStorage.isEncryptionAvailable()) {
      yield* Effect.fail(new Error('Encryption not available'))
    }
    const secretAccessKey = safeStorage.decryptString(row.secretAccessKeyEncrypted as Buffer)
    const apiToken =
      row.apiTokenEncrypted != null
        ? safeStorage.decryptString(row.apiTokenEncrypted as Buffer)
        : undefined
    if (!apiToken) {
      yield* Effect.fail(
        new Error(
          'Cloudflare API token required to provision sharing worker. Edit the connection to add it.'
        )
      )
    }

    const workerName = row.workerName ?? `r2-explorer-${id}`
    const sharesTitle = `r2-explorer-shares-${id}`
    const adminToken = deriveAdminToken(row.accessKeyId, secretAccessKey, id)

    // 1) Ensure KV
    const kvId = yield* Effect.tryPromise({
      try: () => ensureKvNamespace(row.accountId, apiToken!, sharesTitle),
      catch: e =>
        new Error(`Failed to ensure KV namespace: ${e instanceof Error ? e.message : String(e)}`),
    })

    // 2) Load Worker source (pure ESM JS, no external imports)
    const workerPath = path.resolve(process.cwd(), 'cloudflare-worker/worker.mjs')
    const code = yield* Effect.tryPromise({
      try: () => fs.readFile(workerPath, 'utf8'),
      catch: e =>
        new Error(
          `Failed to read worker.mjs at ${workerPath}: ${e instanceof Error ? e.message : String(e)}`
        ),
    })

    // 3) Upload Worker module with bindings
    yield* Effect.tryPromise({
      try: () =>
        uploadWorkerModule({
          accountId: row.accountId,
          apiToken: apiToken!,
          workerName,
          code,
          kvNamespaceId: kvId,
          bindings: {
            CF_ACCOUNT_ID: row.accountId,
            CF_ACCESS_KEY_ID: row.accessKeyId,
            CF_SECRET_ACCESS_KEY: secretAccessKey,
            ADMIN_TOKEN: adminToken,
          },
        }),
      catch: e =>
        new Error(`Failed to deploy Worker: ${e instanceof Error ? e.message : String(e)}`),
    })

    // 3b) Ensure workers.dev subdomain is enabled using the correct API
    const subdomainStatus = yield* Effect.tryPromise({
      try: () => getWorkerSubdomainStatus(row.accountId, apiToken!, workerName),
      catch: e =>
        new Error(
          `Failed to get Worker subdomain status: ${e instanceof Error ? e.message : String(e)}`
        ),
    })

    if (!subdomainStatus.enabled) {
      yield* Effect.tryPromise({
        try: () => enableWorkersSubdomain(row.accountId, apiToken!, workerName, true),
        catch: e =>
          new Error(
            `Failed to enable workers.dev subdomain: ${e instanceof Error ? e.message : String(e)}`
          ),
      })
    }

    // 4) Get workers.dev subdomain
    const subdomain = yield* Effect.tryPromise({
      try: () => getWorkersSubdomain(row.accountId, apiToken!),
      catch: e =>
        new Error(
          `Failed to fetch workers.dev subdomain: ${e instanceof Error ? e.message : String(e)}`
        ),
    })

    const workerUrl = `https://${workerName}.${subdomain}.workers.dev`

    // Persist identity for convenience
    if (!row.workerName || !row.workerSubdomain) {
      yield* Effect.tryPromise(() =>
        db
          .update(connections)
          .set({ workerName, workerSubdomain: subdomain })
          .where(eq(connections.id, id))
      )
    }

    return { workerName, workerUrl, subdomain, adminToken }
  })
