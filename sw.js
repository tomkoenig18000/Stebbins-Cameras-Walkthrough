const C='cam-v25';const FILES=['./','index.html','manifest.json','icon.png','icons/icon-192-v25.png','icons/icon-512-v25.png','icons/apple-touch-icon-v25.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(FILES.map(url=>new Request(url,{cache:'reload'})))));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin||u.pathname.endsWith('version.json'))return;
 e.respondWith(fetch(e.request.mode==='navigate'?new Request(e.request,{cache:'no-store'}):e.request).then(r=>{if(r.ok){const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp))}return r}).catch(()=>caches.match(e.request,{ignoreSearch:true})))});
