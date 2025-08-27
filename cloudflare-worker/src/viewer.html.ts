export function viewerHtml(shareId: string): string {
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
    const shareId = ${JSON.stringify(shareId)};
    let path = new URL(location.href).searchParams.get('path') || '';

    function formatSize(bytes) {
      if (!bytes) return '0 B';
      const sizes = ['B','KB','MB','GB','TB'];
      const i = Math.floor(Math.log(bytes)/Math.log(1024));
      return (bytes/Math.pow(1024,i)).toFixed(1) + ' ' + sizes[i];
    }

    function renderCrumbs() {
      const container = document.getElementById('crumbs');
      const parts = path.split('/').filter(Boolean);
      const links = ['<a href="#" data-index="-1">Root</a>'];
      let acc = '';
      for (let i=0; i<parts.length; i++) {
        acc += parts[i] + '/';
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
            if (!r.ok) {
              alert('Failed to sign');
              return;
            }
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
      if (r.status === 204) {
        load();
      } else {
        pinError.textContent = 'Invalid PIN';
      }
    });

    load();
  </script>
</body>
</html>`
}
