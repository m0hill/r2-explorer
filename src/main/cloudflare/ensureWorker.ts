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

function cfFetchE<T = unknown>(
  accountId: string,
  apiToken: string,
  method: string,
  pathFrag: string,
  init?: RequestInit
) {
  return Effect.gen(function* () {
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/${pathFrag}`
    const resp = yield* Effect.tryPromise({
      try: () =>
        fetch(url, {
          ...init,
          method,
          headers: {
            Authorization: `Bearer ${apiToken}`,
            ...(init?.headers as Record<string, string> | undefined),
          },
        }),
      catch: e =>
        new Error(
          `Cloudflare API network error on ${pathFrag}: ${
            e instanceof Error ? e.message : String(e)
          }`
        ),
    })
    const text = yield* Effect.tryPromise({
      try: () => resp.text(),
      catch: e =>
        new Error(
          `Cloudflare API read error on ${pathFrag}: ${e instanceof Error ? e.message : String(e)}`
        ),
    })
    let json: CfJson<T> | null = null
    try {
      json = JSON.parse(text) as CfJson<T>
    } catch {
      return yield* Effect.fail(
        new Error(`Cloudflare API response not JSON (${resp.status}): ${text.slice(0, 200)}`)
      )
    }
    if (!resp.ok || !json.success) {
      return yield* Effect.fail(
        new Error(
          `Cloudflare API error ${resp.status} on ${pathFrag}: ${JSON.stringify(
            json.errors || text
          )}`
        )
      )
    }
    return json
  })
}

function ensureKvNamespaceE(accountId: string, apiToken: string, title: string) {
  return Effect.gen(function* () {
    const list = yield* cfFetchE<{ id: string; title: string }[]>(
      accountId,
      apiToken,
      'GET',
      `storage/kv/namespaces?per_page=1000`
    )
    const existing = (list.result || []).find(n => n.title === title)
    if (existing) return existing.id
    const created = yield* cfFetchE<{ id: string; title: string }>(
      accountId,
      apiToken,
      'POST',
      `storage/kv/namespaces`,
      {
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title }),
      }
    )
    const id = created.result?.id
    if (!id) {
      return yield* Effect.fail(new Error('Cloudflare API did not return KV namespace id'))
    }
    return id
  })
}

function getWorkersSubdomainE(accountId: string, apiToken: string) {
  return Effect.gen(function* () {
    const res = yield* cfFetchE<{ subdomain: string }>(
      accountId,
      apiToken,
      'GET',
      'workers/subdomain'
    )
    const sub = res.result?.subdomain
    if (!sub) {
      return yield* Effect.fail(new Error('No workers.dev subdomain returned by Cloudflare'))
    }
    return sub
  })
}

function uploadWorkerModuleE(opts: {
  accountId: string
  apiToken: string
  workerName: string
  code: string
  kvNamespaceId: string
  bindings: Record<string, string> // name -> value (plain_text)
}) {
  return Effect.gen(function* () {
    const metadata = {
      main_module: 'worker.mjs',
      compatibility_date: '2024-01-01',
      workers_dev: true,
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
    form.append(
      'worker.mjs',
      new Blob([opts.code], { type: 'application/javascript+module' }),
      'worker.mjs'
    )

    const url = `workers/scripts/${encodeURIComponent(opts.workerName)}`
    const resp = yield* Effect.tryPromise({
      try: () =>
        fetch(`https://api.cloudflare.com/client/v4/accounts/${opts.accountId}/${url}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${opts.apiToken}` },
          body: form,
        }),
      catch: e =>
        new Error(`Upload worker network error: ${e instanceof Error ? e.message : String(e)}`),
    })
    const text = yield* Effect.tryPromise({
      try: () => resp.text(),
      catch: e => new Error(`Upload worker read error: ${e instanceof Error ? e.message : e}`),
    })
    let json: CfJson | null = null
    try {
      json = JSON.parse(text) as CfJson
    } catch {
      return yield* Effect.fail(
        new Error(`Upload worker failed (${resp.status}): ${text.slice(0, 200)}`)
      )
    }
    if (!resp.ok || !json.success) {
      return yield* Effect.fail(
        new Error(`Upload worker failed ${resp.status}: ${JSON.stringify(json.errors || text)}`)
      )
    }
  })
}

function getWorkerSubdomainStatusE(
  accountId: string,
  apiToken: string,
  workerName: string
): ReturnType<typeof cfFetchE<{ enabled: boolean; previews_enabled?: boolean }>> {
  return cfFetchE<{ enabled: boolean; previews_enabled?: boolean }>(
    accountId,
    apiToken,
    'GET',
    `workers/scripts/${encodeURIComponent(workerName)}/subdomain`
  )
}

function enableWorkersSubdomainE(
  accountId: string,
  apiToken: string,
  workerName: string,
  enabled: boolean
): ReturnType<typeof cfFetchE<{ enabled: boolean; previews_enabled?: boolean }>> {
  return cfFetchE<{ enabled: boolean; previews_enabled?: boolean }>(
    accountId,
    apiToken,
    'POST',
    `workers/scripts/${encodeURIComponent(workerName)}/subdomain`,
    {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled, previews_enabled: true }),
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
    const secretAccessKey = yield* Effect.try({
      try: () => safeStorage.decryptString(row.secretAccessKeyEncrypted as Buffer),
      catch: e =>
        new Error(
          `Failed to decrypt secret access key: ${e instanceof Error ? e.message : String(e)}`
        ),
    })
    const apiToken =
      row.apiTokenEncrypted != null
        ? yield* Effect.try({
            try: () => safeStorage.decryptString(row.apiTokenEncrypted as Buffer),
            catch: e =>
              new Error(
                `Failed to decrypt API token: ${e instanceof Error ? e.message : String(e)}`
              ),
          })
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
    const kvId = yield* ensureKvNamespaceE(row.accountId, apiToken!, sharesTitle).pipe(
      Effect.mapError(
        e =>
          new Error(`Failed to ensure KV namespace: ${e instanceof Error ? e.message : String(e)}`)
      )
    )

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
    yield* uploadWorkerModuleE({
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
    }).pipe(
      Effect.mapError(
        e => new Error(`Failed to deploy Worker: ${e instanceof Error ? e.message : String(e)}`)
      )
    )

    // 3b) Ensure workers.dev subdomain is enabled using the correct API
    const subdomainStatus = yield* getWorkerSubdomainStatusE(
      row.accountId,
      apiToken!,
      workerName
    ).pipe(
      Effect.mapError(
        e =>
          new Error(
            `Failed to get Worker subdomain status: ${e instanceof Error ? e.message : String(e)}`
          )
      )
    )

    if (!subdomainStatus.result?.enabled) {
      yield* enableWorkersSubdomainE(row.accountId, apiToken!, workerName, true).pipe(
        Effect.mapError(
          e =>
            new Error(
              `Failed to enable workers.dev subdomain: ${
                e instanceof Error ? e.message : String(e)
              }`
            )
        )
      )
    }

    // 4) Get workers.dev subdomain
    const subdomain = yield* getWorkersSubdomainE(row.accountId, apiToken!).pipe(
      Effect.mapError(
        e =>
          new Error(
            `Failed to fetch workers.dev subdomain: ${e instanceof Error ? e.message : String(e)}`
          )
      )
    )

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
