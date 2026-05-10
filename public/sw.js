const CACHE_NAME = 'sorteosperu-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/css/style.css',
  '/images/icons/icon-192x192.png',
  '/images/icons/icon-512x512.png',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;800&display=swap'
];

// Install event: cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate event: cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event: network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Solo manejar peticiones GET y evitar peticiones de socket.io o admin
  if (event.request.method !== 'GET' || 
      event.request.url.includes('socket.io') || 
      event.request.url.includes('/admin')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Si la red funciona, devolver y cachear si es un recurso estático
        const resClone = response.clone();
        const url = new URL(event.request.url);
        
        // Cachear si está en la lista inicial o es un archivo estático
        const isStaticAsset = ASSETS_TO_CACHE.includes(url.pathname) || 
                             ASSETS_TO_CACHE.includes(event.request.url) ||
                             url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff2)$/);

        if (isStaticAsset && response.status === 200) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, resClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Si falla la red (offline), buscar en cache
        return caches.match(event.request);
      })
  );
});
