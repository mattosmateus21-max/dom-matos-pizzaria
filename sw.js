// Define o nome do cache e os arquivos que serão armazenados para o funcionamento offline.
const CACHE_NAME = 'Projeto-Pizzaria-cache-v2.1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/endepagam.html',
  '/imagens/fanta.webp',
  '/imagens/pizzacala.webp',
  '/imagens/pizzaportuguesa.webp',
  '/pizzamodacasa.webp',
  '/pizzafrangocatupiry.webp',
  '/pizzacalabresaespecial.webp'
];

// Armazena os recursos listados no cache quando o Service Worker é instalado.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Remove caches antigos e ativa o novo Service Worker quando ele entra em funcionamento.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Tenta responder com o cache primeiro e, se não houver, busca na rede.
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  if (requestUrl.protocol !== 'http:' && requestUrl.protocol !== 'https:') {
    return;
  }
  if (requestUrl.origin !== self.location.origin) {
    return;
  }
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      return cachedResponse || fetch(event.request).then(networkResponse => {
        return caches.open(CACHE_NAME).then(cache => {
          if (event.request.destination !== 'document') {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        });
      });
    }).catch(() => caches.match('/index.html'))
  );
});
