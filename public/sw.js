const CACHE_NAME = 'alvo-certo-v1';
const assets = ['/', '/index.html', '/manifest.json'];

// Instala o Service Worker e guarda os arquivos básicos no cache do celular
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(assets);
    })
  );
});

// Ativa o aplicativo
self.addEventListener('activate', (e) => {
  console.log('Service Worker do Alvo Certo Ativado!');
});

// Gerencia as requisições para o app abrir instantaneamente
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => {
      return res || fetch(e.request);
    })
  );
});
