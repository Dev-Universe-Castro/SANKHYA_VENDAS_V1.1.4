
// Service Worker customizado para modo offline completo
const CACHE_VERSION = 'v2'
const CACHE_NAME = `offline-app-${CACHE_VERSION}`

// Lista de rotas para precache
const ROUTES_TO_CACHE = [
  '/',
  '/dashboard',
  '/dashboard/parceiros',
  '/dashboard/produtos',
  '/dashboard/leads',
  '/dashboard/pedidos',
  '/dashboard/financeiro',
  '/dashboard/calendario',
  '/dashboard/chat',
  '/dashboard/analise',
  '/dashboard/equipe',
  '/dashboard/usuarios',
  '/dashboard/configuracoes',
  '/offline'
]

// Instalar e cachear recursos essenciais
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker instalando e cacheando rotas...')
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 Cacheando rotas principais...')
      return cache.addAll(ROUTES_TO_CACHE).catch(err => {
        console.warn('⚠️ Erro ao cachear algumas rotas:', err)
        // Não falhar se algumas rotas não puderem ser cacheadas
      })
    })
  )
  self.skipWaiting()
})

// Ativar e limpar caches antigos
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker ativado')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName.startsWith('offline-app-')) {
            console.log('🗑️ Removendo cache antigo:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    }).then(() => self.clients.claim())
  )
})

// Interceptar requisições - SEMPRE permitir navegação offline
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Ignorar requisições de extensões do navegador
  if (url.protocol === 'chrome-extension:') return

  // Para navegação (páginas HTML) - CACHE FIRST com fallback
  if (request.destination === 'document' || request.mode === 'navigate') {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            console.log('📦 Servindo do cache:', url.pathname)
            
            // Atualizar cache em background se online
            if (navigator.onLine) {
              fetch(request)
                .then((response) => {
                  if (response && response.status === 200) {
                    caches.open('pages-cache').then((cache) => {
                      cache.put(request, response.clone())
                    })
                  }
                })
                .catch(() => {})
            }
            
            return cachedResponse
          }
          
          // Se não está em cache, tentar buscar da rede
          return fetch(request)
            .then((response) => {
              if (response && response.status === 200) {
                const responseClone = response.clone()
                caches.open('pages-cache').then((cache) => {
                  cache.put(request, responseClone)
                })
              }
              return response
            })
            .catch(() => {
              // Se offline e não tem em cache, retornar página offline
              console.log('⚠️ Offline e página não cacheada:', url.pathname)
              return caches.match('/offline').then(offlineResponse => {
                return offlineResponse || new Response('Offline - Página não disponível', {
                  status: 503,
                  statusText: 'Service Unavailable'
                })
              })
            })
        })
    )
    return
  }

  // Para recursos estáticos (_next, css, js, imagens)
  if (url.pathname.startsWith('/_next/') || 
      request.destination === 'style' || 
      request.destination === 'script' ||
      request.destination === 'image') {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse
        }
        
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone()
            caches.open('static-cache').then((cache) => {
              cache.put(request, responseClone)
            })
          }
          return response
        }).catch(() => {
          console.log('⚠️ Recurso não disponível offline:', url.pathname)
          return new Response('', { status: 404 })
        })
      })
    )
    return
  }

  // Para requisições de API - Network first com cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone()
            caches.open('api-cache').then((cache) => {
              cache.put(request, responseClone)
            })
          }
          return response
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              console.log('📦 API offline - servindo do cache:', url.pathname)
              return cachedResponse
            }
            return new Response(JSON.stringify({ error: 'Offline' }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            })
          })
        })
    )
    return
  }

  // Outros recursos - tentar rede primeiro
  event.respondWith(
    fetch(request).catch(() => {
      return caches.match(request)
    })
  )
})

// Sincronização em background
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync:', event.tag)
  
  if (event.tag === 'sync-pedidos') {
    event.waitUntil(syncPedidos())
  }
})

async function syncPedidos() {
  try {
    console.log('🔄 Sincronizando pedidos pendentes...')
    const clients = await self.clients.matchAll()
    clients.forEach((client) => {
      client.postMessage({
        type: 'SYNC_PEDIDOS',
        message: 'Iniciando sincronização de pedidos'
      })
    })
  } catch (error) {
    console.error('❌ Erro na sincronização:', error)
  }
}
