// 临期先知 Service Worker
const CACHE_NAME = 'lq-xianzhi-v1';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/db.js',
  './js/pro.js',
  './js/barcode.js',
  './js/notifications.js',
  './js/app.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

// 安装：预缓存关键资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn('[SW] Precache partial:', err))
  );
});

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// 拦截请求：Cache First 策略
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // 第三方 CDN（idb）走网络
  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});

// 接收主线程消息：触发过期检查
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CHECK_EXPIRY') {
    checkExpiryAndNotify(event.data.items, event.data.warnDays);
  }
});

// 后台同步：每天检查过期并推送
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-expiry') {
    event.waitUntil(checkExpiryBackground());
  }
});

async function checkExpiryBackground() {
  // 通过 IndexedDB 获取数据（Service Worker 不能直接用主线程的 idb 实例）
  // 这里依赖主线程通过 postMessage 定期同步最新数据
  const clients = await self.clients.matchAll();
  for (const client of clients) {
    client.postMessage({ type: 'REQUEST_SYNC' });
  }
}

async function checkExpiryAndNotify(items, warnDays) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const warnMs = warnDays * 24 * 60 * 60 * 1000;

  for (const item of items) {
    if (item.consumed) continue;
    const expiry = new Date(item.expiry);
    const diff = expiry - today;
    const daysLeft = Math.floor(diff / (24 * 60 * 60 * 1000));

    if (daysLeft <= 0) {
      await self.registration.showNotification('临期先知 · 已过期', {
        body: `「${item.name}」已过期，请尽快处理`,
        icon: './assets/icons/icon-192.png',
        badge: './assets/icons/icon-192.png',
        tag: 'expired-' + item.id,
        vibrate: [200, 100, 200]
      });
    } else if (daysLeft <= warnDays) {
      await self.registration.showNotification('临期先知 · 临期提醒', {
        body: `「${item.name}」还剩 ${daysLeft} 天过期`,
        icon: './assets/icons/icon-192.png',
        badge: './assets/icons/icon-192.png',
        tag: 'warn-' + item.id,
        vibrate: [200, 100, 200]
      });
    }
  }
}

// 通知点击：聚焦或打开 App
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./index.html');
    })
  );
});