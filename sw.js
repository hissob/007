// ============================================================
//  Service Worker для PWA «Касса» — v3
//  СТРАТЕГИЯ: stale-while-revalidate для HTML.
//   - открытие МГНОВЕННОЕ из кэша (старт не ждёт сеть!);
//   - свежий HTML качается В ФОНЕ и кладётся в кэш —
//     следующий запуск уже на новой версии;
//   - статика (иконки, манифест) — из кэша;
//   - Apps Script — всегда сеть, мимо кэша.
//  kassa-v3: activate снесёт v1/v2 на всех устройствах.
// ============================================================

var CACHE = 'kassa-v3';
var SHELL = [
  './',
  './index.html',
  './login.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){ return c.addAll(SHELL); })
  );
  self.skipWaiting();
});

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
    // ===== HTML: МГНОВЕННО ИЗ КЭША + ФОНОВОЕ ОБНОВЛЕНИЕ =====
    e.respondWith(
      caches.match(e.request).then(function(hit){
        // фоновая догрузка свежей версии в кэш (не блокирует ответ)
        var refresh = fetch(e.request).then(function(resp){
          if(resp && resp.ok){
            var copy = resp.clone();
            caches.open(CACHE).then(function(c){ c.put(e.request, copy); }).catch(function(){});
          }
          return resp;
        }).catch(function(){ return null; });

        // есть в кэше — отдаём сразу; нет — ждём сеть (первый запуск)
        return hit || refresh.then(function(resp){
          return resp || caches.match('./index.html');
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