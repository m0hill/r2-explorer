// Minimal viewer HTML
function viewerHtml(shareId) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Shared Folder</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 1rem; }
  .container { max-width: 840px; margin: 0 auto; }
  .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
  .muted { color: #666; font-size: 12px; }
  .btn { padding: 6px 10px; border: 1px solid #ccc; border-radius: 6px; background: #fff; cursor: pointer; }
  .btn:hover { background: #f6f6f6; }
  .error { color: #b91c1c; }
  .crumbs { margin-bottom: 12px; }
  .crumbs a { color: #2563eb; text-decoration: none; margin-right: 6px; }
  .pin { margin: 12px 0; }
  .hidden { display: none; }
</style>
</head>
<body>
<div class="container">
  <h2>Shared Folder</h2>
  <div id="pin-section" class="pin hidden">
    <label>PIN required</label><br/>
    <input id="pin-input" type="password" inputmode="numeric" pattern="[0-9]*" placeholder="4-digit PIN" />
    <button id="pin-btn" class="btn">Unlock</button>
    <div id="pin-error" class="error"></div>
  </div>
  <div id="crumbs" class="crumbs"></div>
  <div id="list"></div>
</div>
<script>
  const shareId = ${JSON.stringify('')} + location.pathname.split('/').pop();
  let path = new URL(location.href).searchParams.get('path') || '';
  function renderCrumbs() {
    const container = document.getElementById('crumbs');
    const parts = path.split('/').filter(Boolean);
    const links = ['<a href="#" data-index="-1">Root</a>'];
    for (let i=0; i<parts.length; i++) {
      links.push('<a href="#" data-index="'+i+'">'+parts[i]+'</a>');
    }
    container.innerHTML = links.join(' / ');
    container.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const idx = parseInt(a.getAttribute('data-index'));
        if (idx === -1) path = '';
        else path = parts.slice(0, idx+1).join('/') + '/';
        load();
      });
    });
  }
  async function load() {
    renderCrumbs();
    const listEl = document.getElementById('list');
    const pinSection = document.getElementById('pin-section');
    const pinError = document.getElementById('pin-error');
    pinError.textContent = '';
    try {
      const resp = await fetch(\`/s/\${shareId}/list?path=\${encodeURIComponent(path)}\`);
      if (resp.status === 401) {
        pinSection.classList.remove('hidden');
        listEl.innerHTML = '';
        return;
      }
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(t || 'Failed to load');
      }
      const data = await resp.json();
      pinSection.classList.add('hidden');
      const rows = [];
      for (const f of data.folders) {
        rows.push(\`<div class="row"><div>📁 <a href="#" data-folder="\${f}">\${f.replace(/\\/$/, '')}</a></div><div class="muted">Folder</div></div>\`);
      }
      for (const o of data.objects) {
        rows.push(\`<div class="row"><div>📄 \${o.key}</div><div><button class="btn" data-file="\${o.key}">Download</button></div></div>\`);
      }
      listEl.innerHTML = rows.join('') || '<div class="muted">Empty</div>';
      listEl.querySelectorAll('[data-folder]').forEach(el => {
        el.addEventListener('click', (e) => {
          e.preventDefault();
          const name = el.getAttribute('data-folder');
          path = path + name;
          load();
        });
      });
      listEl.querySelectorAll('[data-file]').forEach(el => {
        el.addEventListener('click', async () => {
          const key = el.getAttribute('data-file');
          const r = await fetch(\`/s/\${shareId}/sign?key=\${encodeURIComponent(key)}\`);
          if (!r.ok) { alert('Failed to sign'); return; }
          const j = await r.json();
          location.href = j.url;
        });
      });
    } catch (e) {
      listEl.innerHTML = '<div class="error">'+(e.message || e)+'</div>';
    }
  }
  document.getElementById('pin-btn').addEventListener('click', async () => {
    const input = document.getElementById('pin-input');
    const pin = input.value;
    const pinError = document.getElementById('pin-error');
    pinError.textContent = '';
    const r = await fetch('/s/'+shareId+'/pin', { method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({ pin }) });
    if (r.status === 204) load(); else pinError.textContent = 'Invalid PIN';
  });
  load();
</script>
</body>
</html>`
}

// Utils
const enc = new TextEncoder()
function toHex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}
function fromUtf8(s) {
  return enc.encode(s)
}
function b64urlFromBuf(buf) {
  let s = btoa(String.fromCharCode(...new Uint8Array(buf)))
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
async function sha256HexStr(s) {
  return toHex(await crypto.subtle.digest('SHA-256', fromUtf8(s)))
}
async function hmacRaw(keyBytes, data) {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  return crypto.subtle.sign('HMAC', key, typeof data === 'string' ? fromUtf8(data) : data)
}
function concatBytes(a, b) {
  const out = new Uint8Array(a.byteLength + b.byteLength)
  out.set(new Uint8Array(a), 0)
  out.set(new Uint8Array(b), a.byteLength)
  return out.buffer
}

// Share model and env types
/**
 * @typedef {{ id:string; bucket:string; prefix:string; expiresAt:string; pinSalt?:string; pinHash?:string }} Share
 */

/**
 * @param {Request} request
 * @param {Env} env
 */
async function handle(request, env) {
  const url = new URL(request.url)
  const { pathname, origin, searchParams } = url

  // Admin: create share
  if (pathname === '/admin/shares' && request.method === 'POST') {
    const token = request.headers.get('X-Admin-Token') || ''
    if (token !== env.ADMIN_TOKEN) return new Response('unauthorized', { status: 401 })
    const body = await request.json()
    const { bucket, prefix, expiresInSec, pin } = body || {}
    if (!bucket || !prefix || !expiresInSec) return new Response('missing fields', { status: 400 })
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 18)
    const expiresAt = new Date(Date.now() + Number(expiresInSec) * 1000).toISOString()
    /** @type {Share} */
    const share = {
      id,
      bucket,
      prefix: prefix.endsWith('/') ? prefix : prefix + '/',
      expiresAt,
    }
    if (pin && /^[0-9]{4}$/.test(pin)) {
      const salt = crypto.getRandomValues(new Uint8Array(16))
      const saltHex = toHex(salt.buffer)
      const hash = await sha256HexStr(`${saltHex}:${pin}`)
      share.pinSalt = saltHex
      share.pinHash = hash
    }
    await env.SHARES.put(`share:${id}`, JSON.stringify(share), {
      expirationTtl: Number(expiresInSec),
    })
    return json({ id, url: `${origin}/s/${id}`, expiresAt })
  }

  const m = pathname.match(/^\/s\/([A-Za-z0-9_-]{6,})/)
  if (m && request.method === 'GET' && pathname === `/s/${m[1]}`) {
    return new Response(viewerHtml(m[1]), {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }

  if (m && request.method === 'POST' && pathname === `/s/${m[1]}/pin`) {
    const id = m[1]
    const s = await readShare(env, id)
    if (!s) return new Response('expired', { status: 410 })
    if (!s.pinHash || !s.pinSalt) return new Response(null, { status: 204 })
    const { pin } = await request.json()
    const hash = await sha256HexStr(`${s.pinSalt}:${pin || ''}`)
    if (hash !== s.pinHash) return new Response('invalid', { status: 401 })
    const sig = await signCookie(env, id)
    const maxAge = Math.max(1, Math.floor((new Date(s.expiresAt).getTime() - Date.now()) / 1000))
    const headers = new Headers()
    headers.set(
      'Set-Cookie',
      `auth_${id}=${sig}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax; Path=/`
    )
    return new Response(null, { status: 204, headers })
  }

  if (m && request.method === 'GET' && pathname === `/s/${m[1]}/list`) {
    const id = m[1]
    const s = await readShare(env, id)
    if (!s) return new Response('expired', { status: 410 })
    if (!(await hasCookie(env, request, id))) return new Response('pin required', { status: 401 })
    const relPath = searchParams.get('path') || ''
    if (relPath.includes('..')) return new Response('invalid path', { status: 400 })
    const absPrefix = s.prefix + relPath
    const { folders, objects } = await listObjectsV2(env, s.bucket, absPrefix)
    const foldersRel = folders.map(p => p.slice(absPrefix.length))
    const objectsRel = objects
      .filter(o => !o.key.endsWith('/'))
      .map(o => ({
        key: o.key.slice(absPrefix.length),
        size: o.size,
        lastModified: o.lastModified,
      }))
    return json({ folders: foldersRel, objects: objectsRel })
  }

  if (m && request.method === 'GET' && pathname === `/s/${m[1]}/sign`) {
    const id = m[1]
    const s = await readShare(env, id)
    if (!s) return new Response('expired', { status: 410 })
    if (!(await hasCookie(env, request, id))) return new Response('pin required', { status: 401 })
    const relKey = searchParams.get('key') || ''
    if (relKey.includes('..')) return new Response('invalid key', { status: 400 })
    const absKey = s.prefix + relKey
    if (!absKey.startsWith(s.prefix)) return new Response('invalid key', { status: 400 })
    const urlSigned = await presignGet(env, s.bucket, absKey, 600)
    return json({ url: urlSigned })
  }

  return new Response('not found', { status: 404 })
}

async function readShare(env, id) {
  const jsonStr = await env.SHARES.get(`share:${id}`)
  if (!jsonStr) return null
  const s = JSON.parse(jsonStr)
  if (new Date(s.expiresAt).getTime() <= Date.now()) {
    await env.SHARES.delete(`share:${id}`)
    return null
  }
  return s
}

function parseCookies(header) {
  const out = {}
  if (!header) return out
  const parts = header.split(';')
  for (const p of parts) {
    const [k, v] = p.split('=')
    if (k && v) out[k.trim()] = v.trim()
  }
  return out
}
async function signCookie(env, id) {
  const sig = await hmacRaw(fromUtf8(env.ADMIN_TOKEN), `ok:${id}`)
  return b64urlFromBuf(sig)
}
async function hasCookie(env, request, id) {
  const s = parseCookies(request.headers.get('cookie'))
  const val = s[`auth_${id}`]
  if (!val) return false
  const expected = await signCookie(env, id)
  return val === expected
}

function json(obj) {
  return new Response(JSON.stringify(obj), { headers: { 'content-type': 'application/json' } })
}

// SigV4 helpers for R2 S3 API (region "auto", service "s3")
function amzDateNow() {
  const d = new Date()
  const yyyy = d.getUTCFullYear().toString()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mi = String(d.getUTCMinutes()).padStart(2, '0')
  const ss = String(d.getUTCSeconds()).padStart(2, '0')
  return { date: `${yyyy}${mm}${dd}`, dateTime: `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z` }
}

function encodeRfc3986(str) {
  return encodeURIComponent(str).replace(
    /[!*'()]/g,
    c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  )
}
function canonicalQuery(params) {
  const pairs = []
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    pairs.push([encodeRfc3986(k), encodeRfc3986(String(v))])
  }
  pairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1].localeCompare(b[1])))
  return pairs.map(([k, v]) => `${k}=${v}`).join('&')
}

async function signingKey(secret, date, region, service) {
  let kDate = await hmacRaw(fromUtf8('AWS4' + secret), date)
  let kRegion = await hmacRaw(kDate, region)
  let kService = await hmacRaw(kRegion, service)
  return hmacRaw(kService, 'aws4_request')
}

async function presignGet(env, bucket, key, expiresSec) {
  const host = `${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`
  const region = 'auto'
  const service = 's3'
  const { date, dateTime } = amzDateNow()

  const credential = `${env.CF_ACCESS_KEY_ID}/${date}/${region}/${service}/aws4_request`
  const qsBase = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': dateTime,
    'X-Amz-Expires': String(expiresSec),
    'X-Amz-SignedHeaders': 'host',
  }

  const path = `/${encodeRfc3986(bucket)}/${key.split('/').map(encodeRfc3986).join('/')}`
  const queryStr = canonicalQuery(qsBase)
  const canonicalHeaders = `host:${host}\n`
  const canonicalRequest = [
    'GET',
    path,
    queryStr,
    canonicalHeaders,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n')

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    dateTime,
    `${date}/${region}/${service}/aws4_request`,
    toHex(await crypto.subtle.digest('SHA-256', fromUtf8(canonicalRequest))),
  ].join('\n')

  const keySigning = await signingKey(env.CF_SECRET_ACCESS_KEY, date, region, service)
  const signatureBuf = await hmacRaw(keySigning, stringToSign)
  const signature = toHex(signatureBuf)

  const finalQs = queryStr + `&X-Amz-Signature=${signature}`
  return `https://${host}${path}?${finalQs}`
}

async function listObjectsV2(env, bucket, prefix) {
  const host = `${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`
  const region = 'auto'
  const service = 's3'
  const { date, dateTime } = amzDateNow()
  const credential = `${env.CF_ACCESS_KEY_ID}/${date}/${region}/${service}/aws4_request`

  const baseParams = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': dateTime,
    'X-Amz-Expires': '300',
    'X-Amz-SignedHeaders': 'host',
    delimiter: '/',
    'list-type': '2',
    prefix: prefix,
  }
  const path = `/${encodeRfc3986(bucket)}`
  const queryStr = canonicalQuery(baseParams)
  const canonicalHeaders = `host:${host}\n`
  const canonicalRequest = [
    'GET',
    path,
    queryStr,
    canonicalHeaders,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n')
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    dateTime,
    `${date}/${region}/${service}/aws4_request`,
    toHex(await crypto.subtle.digest('SHA-256', fromUtf8(canonicalRequest))),
  ].join('\n')
  const keySigning = await signingKey(env.CF_SECRET_ACCESS_KEY, date, region, service)
  const signature = toHex(await hmacRaw(keySigning, stringToSign))
  const finalQs = queryStr + `&X-Amz-Signature=${signature}`

  const url = `https://${host}${path}?${finalQs}`
  const r = await fetch(url, { method: 'GET' })
  if (!r.ok) throw new Error(`List failed: ${r.status}`)
  const xml = await r.text()
  const folders = [
    ...xml.matchAll(/<CommonPrefixes>\s*<Prefix>([^<]+)<\/Prefix>\s*<\/CommonPrefixes>/g),
  ].map(m => m[1])
  const objects = [
    ...xml.matchAll(
      /<Contents>\s*<Key>([^<]+)<\/Key>[\s\S]*?<Size>(\d+)<\/Size>[\s\S]*?(?:<LastModified>([^<]+)<\/LastModified>)?[\s\S]*?<\/Contents>/g
    ),
  ].map(m => ({ key: m[1], size: Number(m[2] || '0'), lastModified: m[3] || undefined }))
  return { folders, objects }
}

export default {
  async fetch(request, env) {
    try {
      return await handle(request, env)
    } catch (e) {
      return new Response(e && e.message ? `error: ${e.message}` : 'error', { status: 500 })
    }
  },
}
