/**
 * Service Worker — 轻盈笔记 PWA 离线支持
 * 缓存策略: Cache First (静态资源优先从缓存读取)
 */

const CACHE_NAME = 'weight-loss-tracker-v1';

// 需要缓存的静态资源
const STATIC_ASSETS = [
  '.',
  'index.html',
  'manifest.json',
  'css/style.css',
  'js/db.js',
  'js/app.js',
  'js/charts.js',
  'icons/icon.svg',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js',
];

// ====== Install: 预缓存所有静态资源 ======
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        // 某个资源下载失败不阻塞安装
        console.warn('[SW] Cache addAll partial failure:', err);
      });
    })
  );
  // 立即激活，不等待旧 SW
  self.skipWaiting();
});

// ====== Activate: 清理旧缓存 ======
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  // 立即接管所有页面
  self.clients.claim();
});

// ====== Fetch: Cache First 策略 ======
self.addEventListener('fetch', (event) => {
  // 只处理 GET 请求
  if (event.request.method !== 'GET') return;

  // 跳过 chrome-extension 等非 http(s) 请求
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // 缓存命中，同时在后台更新缓存
        const fetchPromise = fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return response;
        }).catch(() => null);

        // 立即返回缓存，后台更新
        return cached;
      }

      // 缓存未命中，发起网络请求
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200) return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clone);
        });
        return response;
      }).catch(() => {
        // 网络失败且无缓存，对于 HTML 请求返回离线页面
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('index.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
