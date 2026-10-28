// Service worker do Meu Fluxo: deixa o app abrir sem internet.
// Arquivos do app: tenta a rede primeiro (para pegar atualizações) e usa o cache se estiver offline.
// Fontes do Google: usa o cache primeiro, já que não mudam.

const CACHE = "meufluxo-v5";

const ARQUIVOS = [
  "./",
  "index.html",
  "style.css",
  "js/app.js",
  "js/categorias.js",
  "js/renda.js",
  "js/parcelas.js",
  "js/excel.js",
  "js/sync.js",
  "libs/bootstrap-5.3.8.min.css",
  "libs/bootstrap-5.3.8.bundle.min.js",
  "libs/exceljs-4.4.0.min.js",
  "libs/supabase-js-2.117.3.min.js",
  "favicon.svg",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(
      caches.match(req).then(
        (salvo) =>
          salvo ||
          fetch(req).then((resp) => {
            const copia = resp.clone();
            caches.open(CACHE).then((c) => c.put(req, copia));
            return resp;
          }),
      ),
    );
    return;
  }

  if (url.origin !== location.origin) return;

  e.respondWith(
    fetch(req)
      .then((resp) => {
        if (resp.ok) {
          const copia = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, copia));
        }
        return resp;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((salvo) => salvo || caches.match("index.html"))),
  );
});
