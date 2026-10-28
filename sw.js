/* Hanbit Studio service worker: keeps the whole app available offline */
const V='studio-1.1.0-en-flat';
const CORE=["./", "./index.html", "./manifest.webmanifest", "./wt1-engine.js", "./glass-bell.hbplug.js", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png", "./worklet-hb-bass.js", "./worklet-hb-crusher.js", "./worklet-hb-recorder.js"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);if(u.origin!==location.origin)return;
  e.respondWith(caches.match(r,{ignoreSearch:true}).then(m=>m||fetch(r).then(res=>{if(res.ok){const c=res.clone();caches.open(V).then(ca=>ca.put(r,c));}return res;})).catch(()=>caches.match('./index.html')));});
