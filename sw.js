// ============================================================
//  Service Worker для PWA «Касса»
//  Кэширует оболочку, чтобы приложение устанавливалось и
//  открывалось офлайн. Данные (apiCall к Apps Script) НЕ
//  кэшируются — они всегда идут в сеть.
// ============================================================

var CACHE = 'kassa-v1';
var SHELL = [
  './',
  './index.html',
  './login.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png'
];

// установка: кладём оболочку в кэш
self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){ return c.addAll(SHELL); })
  );
  self.skipWaiting();
});

// активация: чистим старые версии кэша
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

// запросы:
//  - на Apps Script (script.google.com) — всегда сеть, мимо кэша;
//  - на свою оболочку — сначала кэш, потом сеть.
self.addEventListener('fetch', function(e){
  var url = e.request.url;

  // данные приложения — всегда сеть
  if(url.indexOf('script.google.com') !== -1 || url.indexOf('script.googleusercontent.com') !== -1){
    return; // браузер сам сходит в сеть
  }

  // только GET оболочки кэшируем
  if(e.request.method !== 'GET'){ return; }

  e.respondWith(
    caches.match(e.request).then(function(hit){
      if(hit) return hit;
      return fetch(e.request).then(function(resp){
        // кладём в кэш свежие файлы оболочки
        var copy = resp.clone();
        caches.open(CACHE).then(function(c){ c.put(e.request, copy); }).catch(function(){});
        return resp;
      }).catch(function(){
        // офлайн и нет в кэше — отдаём index как fallback
        return caches.match('./index.html');
      });
    })
  );
});
