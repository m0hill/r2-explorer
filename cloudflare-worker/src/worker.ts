import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { viewerHtml } from './viewer.html'

// Cloudflare Workers types
declare global {
  interface ExecutionContext {
    waitUntil(promise: Promise<any>): void
    passThroughOnException(): void
  }
}

interface KVNamespace {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
}

type Share = {
  id: string
  bucket: string
  prefix: string
  expiresAt: string
  pinSalt?: string
  pinHash?: string
}

type Env = {
  SHARES: KVNamespace
  CF_ACCOUNT_ID: string
  CF_ACCESS_KEY_ID: string
  CF_SECRET_ACCESS_KEY: string
  ADMIN_TOKEN: string
}

function toHex(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf)
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function fromUtf8(s: string) {
  return new TextEncoder().encode(s)
}

function toBase64Url(buf: ArrayBuffer) {
  let s = btoa(String.fromCharCode(...new Uint8Array(buf)))
  s = s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  return s
}

async function sha256Hex(data: string) {
  const d = await crypto.subtle.digest('SHA-256', fromUtf8(data))
  return toHex(d)
}

async function hmacBase64(env: Env, value: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    fromUtf8(env.ADMIN_TOKEN),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, fromUtf8(value))
  return toBase64Url(sig)
}

function parseCookies(header: string | null) {
  const out: Record<string, string> = {}
  if (!header) return out
  const parts = header.split(';')
  for (const p of parts) {
    const [k, v] = p.split('=')
    if (k && v) out[k.trim()] = v.trim()
  }
  return out
}

async function readShare(env: Env, id: string): Promise<Share | null> {
  const json = await env.SHARES.get(`share:${id}`)
  if (!json) return null
  const s = JSON.parse(json) as Share
  if (new Date(s.expiresAt).getTime() <= Date.now()) {
    await env.SHARES.delete(`share:${id}`)
    return null
  }
  return s
}

function s3(env: Env) {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.CF_ACCESS_KEY_ID,
      secretAccessKey: env.CF_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  })
}

function ok(json: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(json), {
    headers: { 'content-type': 'application/json', ...init?.headers },
    status: init?.status ?? 200,
  })
}

function bad(status: number, msg: string) {
  return new Response(msg, { status })
}

async function requireAdmin(request: Request, env: Env) {
  const token = request.headers.get('X-Admin-Token') || ''
  if (token !== env.ADMIN_TOKEN) {
    return false
  }
  return true
}

async function requireAuthForShare(request: Request, env: Env, shareId: string, s: Share) {
  if (!s.pinHash) return true
  const cookies = parseCookies(request.headers.get('cookie'))
  const val = cookies[`auth_${shareId}`]
  if (!val) return false
  const expected = await hmacBase64(env, `ok:${shareId}`)
  return val === expected
}

async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const { pathname, origin, searchParams } = url

  if (pathname === '/admin/shares' && request.method === 'POST') {
    if (!(await requireAdmin(request, env))) return bad(401, 'unauthorized')
    const body = (await request.json()) as {
      bucket: string
      prefix: string
      expiresInSec: number
      pin?: string
    }
    if (!body.bucket || !body.prefix || !body.expiresInSec) {
      return bad(400, 'missing fields')
    }
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 18)
    const expiresAt = new Date(Date.now() + body.expiresInSec * 1000).toISOString()
    const share: Share = {
      id,
      bucket: body.bucket,
      prefix: body.prefix.endsWith('/') ? body.prefix : body.prefix + '/',
      expiresAt,
    }
    if (body.pin && /^[0-9]{4}$/.test(body.pin)) {
      const salt = crypto.getRandomValues(new Uint8Array(16))
      const saltHex = toHex(salt.buffer)
      const hash = await sha256Hex(`${saltHex}:${body.pin}`)
      share.pinSalt = saltHex
      share.pinHash = hash
    }
    await env.SHARES.put(`share:${id}`, JSON.stringify(share), {
      expirationTtl: body.expiresInSec,
    })
    return ok({ id, url: `${origin}/s/${id}`, expiresAt })
  }

  const matchShare = pathname.match(/^\/s\/([A-Za-z0-9_-]{6,})/)
  if (matchShare && request.method === 'GET' && pathname === `/s/${matchShare[1]}`) {
    const id = matchShare[1]
    return new Response(viewerHtml(id), {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }

  if (matchShare && request.method === 'POST' && pathname === `/s/${matchShare[1]}/pin`) {
    const id = matchShare[1]
    const s = await readShare(env, id)
    if (!s) return bad(410, 'expired')
    if (!s.pinHash || !s.pinSalt) return new Response(null, { status: 204 })

    const body = (await request.json()) as { pin?: string }
    const pin = body.pin ?? ''
    const hash = await sha256Hex(`${s.pinSalt}:${pin}`)
    if (hash !== s.pinHash) return bad(401, 'invalid')

    const sig = await hmacBase64(env, `ok:${id}`)
    const maxAge = Math.max(1, Math.floor((new Date(s.expiresAt).getTime() - Date.now()) / 1000))
    const headers = new Headers()
    headers.set(
      'Set-Cookie',
      `auth_${id}=${sig}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax; Path=/`
    )
    return new Response(null, { status: 204, headers })
  }

  if (matchShare && request.method === 'GET' && pathname === `/s/${matchShare[1]}/list`) {
    const id = matchShare[1]
    const s = await readShare(env, id)
    if (!s) return bad(410, 'expired')
    if (!(await requireAuthForShare(request, env, id, s))) return bad(401, 'pin required')

    const relPath = searchParams.get('path') || ''
    if (relPath.includes('..')) return bad(400, 'invalid path')
    const absPrefix = s.prefix + relPath
    const client = s3(env)
    const resp = await client.send(
      new ListObjectsV2Command({
        Bucket: s.bucket,
        Prefix: absPrefix,
        Delimiter: '/',
      })
    )
    const folders = (resp.CommonPrefixes || [])
      .map(p => p.Prefix!)
      .map(p => p.slice(absPrefix.length))
    const objects = (resp.Contents || [])
      .filter(o => o.Key && !o.Key!.endsWith('/'))
      .map(o => ({
        key: o.Key!.slice(absPrefix.length),
        size: o.Size,
        lastModified: o.LastModified?.toISOString?.() ?? undefined,
      }))
    return ok({ folders, objects })
  }

  if (matchShare && request.method === 'GET' && pathname === `/s/${matchShare[1]}/sign`) {
    const id = matchShare[1]
    const s = await readShare(env, id)
    if (!s) return bad(410, 'expired')
    if (!(await requireAuthForShare(request, env, id, s))) return bad(401, 'pin required')
    const relKey = searchParams.get('key') || ''
    if (relKey.includes('..')) return bad(400, 'invalid key')
    const absKey = s.prefix + relKey
    if (!absKey.startsWith(s.prefix)) return bad(400, 'invalid key')

    const client = s3(env)
    const cmd = new GetObjectCommand({ Bucket: s.bucket, Key: absKey })
    const url = await getSignedUrl(client, cmd, { expiresIn: 600 })
    return ok({ url })
  }

  return bad(404, 'not found')
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handle(request, env)
    } catch (e) {
      return new Response((e as Error)?.message ? `error: ${(e as Error).message}` : 'error', {
        status: 500,
      })
    }
  },
}
