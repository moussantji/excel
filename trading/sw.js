/* =========================================================
   sw.js — Service worker (application installable, hors ligne)
   Stratégies :
   - navigation : réseau d'abord, repli sur le cache (usage hors ligne)
   - fichiers de l'app : cache d'abord + mise à jour en arrière-plan
   - données : jamais mises en cache (elles vivent dans localStorage)
   ========================================================= */
'use strict';

const VERSION = 'trading-desk-v13';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/styles.css',
  './assets/js/store.js',
  './assets/js/metrics.js',
  './assets/js/charts.js',
  './assets/js/plan.js',
  './assets/js/ui.js',
  './assets/js/graphe.js',
  './assets/js/views.js',
  './assets/js/app.js',
  './assets/js/pwa.js',
  './assets/js/sync.js',
  './assets/js/lock.js',
  './assets/js/notify.js',
  './assets/js/entraineur.js',
  './assets/js/relecture.js',
  './assets/js/formation-contenu.js',
  './assets/js/formation.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/favicon-32.png'
];

/* ---- rappels du plan : un appui sur la notification ouvre l'application ---- */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const cible = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if ('focus' in client) {
        try { await client.focus(); } catch (e) { /* fenêtre déjà active */ }
        if ('navigate' in client) { try { await client.navigate(cible); } catch (e) { /* ignore */ } }
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(cible);
  })());
});

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // addAll échoue en bloc si une seule URL manque : on ajoute individuellement
    await Promise.all(CORE.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => null)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

function isAppAsset(url) {
  return url.origin === self.location.origin &&
    /\.(css|js|html|png|jpg|jpeg|svg|webmanifest|woff2?|ico)$/i.test(url.pathname);
}

/** Code de l'application : on veut toujours la dernière version quand le
 *  réseau est disponible (mise à jour au premier rechargement), tout en
 *  gardant une copie pour le mode hors ligne. */
function isCode(url) {
  return /\.(js|css|html|webmanifest)$/i.test(url.pathname) || url.pathname.endsWith('/');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return; // exports externes : laisser passer

  // 1. Navigations (ouverture de l'app, installation sur l'écran d'accueil)
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(VERSION);
        cache.put('./index.html', fresh.clone()).catch(() => null);
        return fresh;
      } catch (e) {
        const cached = await caches.match('./index.html', { ignoreSearch: true });
        if (cached) return cached;
        return new Response(
          '<!doctype html><meta charset="utf-8"><title>Hors ligne</title>' +
          '<body style="background:#080a0e;color:#e9edf6;font-family:sans-serif;padding:32px">' +
          '<h1>Application hors ligne</h1><p>Ouvrez l\'application une première fois avec une connexion, puis relancez-la : ' +
          'elle fonctionnera ensuite sans réseau.</p></body>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 200 }
        );
      }
    })());
    return;
  }

  // 2a. Code (JS/CSS/HTML) : réseau d'abord → la mise à jour arrive au
  //     premier rechargement ; repli sur le cache si le réseau est absent.
  if (isAppAsset(url) && isCode(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      let cached = null;
      try { cached = await cache.match(req, { ignoreSearch: true }); } catch (e) { cached = null; }
      try {
        const fresh = await fetch(req);
        // serveur en panne ou réponse invalide : la copie hors ligne est meilleure qu'une page cassée
        if (!fresh || !fresh.ok) return cached || fresh || Response.error();
        cache.put(req, fresh.clone()).catch(() => null);
        return fresh;
      } catch (e) {
        return cached || Response.error();
      }
    })());
    return;
  }

  // 2b. Images et icônes : cache d'abord (elles changent rarement)
  if (isAppAsset(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req).then((res) => {
        if (res && res.ok) cache.put(req, res.clone()).catch(() => null);
        return res;
      }).catch(() => null);
      return cached || (await network) || Response.error();
    })());
    return;
  }

  // 3. Le reste (ex. sauvegardes JSON exportées) : réseau direct
});
