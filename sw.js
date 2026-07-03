// ============================================================
//  Service Worker для PWA «Касса» — v2
//  СТРАТЕГИЯ:
//   - HTML (index/login) — СНАЧАЛА СЕТЬ, кэш только как офлайн-запас.
//     Иначе телефон вечно показывает старую версию из кэша.
//   - статика (иконки, манифест) — сначала кэш (им обновляться незачем).
//   - Apps Script — всегда сеть, мимо кэша.
//  Имя кэша поднято до kassa-v2: activate снесёт старый kassa-v1
//  на всех застрявших устройствах.
// ============================================================

var CACHE = 'kassa-v2';   // ← поднимать при смене стратегии кэширования
var SHELL = [
  './',
  './index.html',
  './login.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png'
];

// установка: кладём оболочку в кэш (запас на офлайн)
self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){ return c.addAll(SHELL); })
  );
  self.skipWaiting();
});

// активация: чистим ВСЕ старые версии кэша (kassa-v1 и т.д.)
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if(k !== CACHE) return caches.delete(k);
      }));
    })
  );
  self.clients.claim();
});

// HTML-запрос? (открытие страницы или сам .html файл)
function isHtml_(req){
  if(req.mode === 'navigate') return true;
  var url = req.url.split('?')[0];
  return /\.html$/.test(url) || /\/$/.test(url);
}

self.addEventListener('fetch', function(e){
  var url = e.request.url;

  // данные приложения — всегда сеть, не вмешиваемся
  if(url.indexOf('script.google.com') !== -1 || url.indexOf('script.googleusercontent.com') !== -1){
    return;
  }
  if(e.request.method !== 'GET'){ return; }

  if(isHtml_(e.request)){
    // ===== HTML: СНАЧАЛА СЕТЬ =====
    e.respondWith(
      fetch(e.request).then(function(resp){
        // свежий HTML кладём в кэш как офлайн-запас
        var copy = resp.clone();
        caches.open(CACHE).then(function(c){ c.put(e.request, copy); }).catch(function(){});
        return resp;
      }).catch(function(){
        // сети нет — отдаём из кэша (последняя скачанная версия)
        return caches.match(e.request).then(function(hit){
          return hit || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // ===== статика: сначала кэш, потом сеть =====
  e.respondWith(
    caches.match(e.request).then(function(hit){
      if(hit) return hit;
      return fetch(e.request).then(function(resp){
        var copy = resp.clone();
        caches.open(CACHE).then(function(c){ c.put(e.request, copy); }).catch(function(){});
        return resp;
      }).catch(function(){
        return caches.match('./index.html');
      });
    })
  );
});