// 道路表編輯器：離線快取（Service Worker）
// - 打開網頁：先向網路抓最新版（有網路時跟沒裝 App 一樣，部署後立刻是新版）；沒網路或太慢才用存起來的那份
// - 圖示、manifest：先用存起來的，背景再更新
// - 雲端同步（GitHub）、AI、班次查詢等其他網站的連線：完全不經過這裡
// 版本號每次建置都會換（dba61ae42842），舊的快取會自動清掉
const CACHE = 'road-editor-dba61ae42842';
const CORE = ['./', 'manifest.webmanifest?v=2', 'icon-192.png?v=2', 'icon-512.png?v=2', 'apple-touch-icon.png?v=2'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('road-editor-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const timeout = (ms, p) => new Promise((ok, no) => { const t = setTimeout(() => no(new Error('timeout')), ms); p.then(v => { clearTimeout(t); ok(v); }, err => { clearTimeout(t); no(err); }); });
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname === new URL(self.registration.scope).pathname) {
    // 網頁本身：網路優先（8 秒內沒回應才用快取）
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const res = await timeout(8000, fetch(req, { cache: 'no-store' }));
        if (res.ok) c.put('./', res.clone());
        return res;
      } catch {
        return (await c.match('./')) || (await caches.match(req, { ignoreSearch: true })) || new Response('<meta charset="utf-8"><p style="font:18px sans-serif;padding:24px">目前沒有網路，這台裝置也還沒有存過離線版本。請連上網路後再打開一次。</p>', { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }
  // 圖示、manifest 等：快取優先，背景更新
  e.respondWith((async () => {
    const c = await caches.open(CACHE), hit = await c.match(req);
    const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
    return hit || (await net) || new Response('', { status: 504 });
  })());
});
