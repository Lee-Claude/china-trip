const CACHE = "china-trip-v2026-09-09.5";
const ASSETS = ["./", "./index.html", "./manifest.json", "./icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function offlinePage() {
  const c = await caches.open(CACHE);
  const hit = (await c.match("./index.html")) || (await c.match("./"));
  if (hit) return hit;
  return new Response(
    "<meta charset='utf-8'><body style='font:16px/1.6 -apple-system;padding:40px;text-align:center'>"
    + "当前离线，而且这台设备还没缓存过页面。<br>联网打开一次后就能离线使用了。</body>",
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 页面：网络优先；★但拿到的不是 200（沙箱停机时网关返 403/404 错误页）一律回退缓存
  const isDoc =
    req.mode === "navigate" || (req.headers.get("accept") || "").indexOf("text/html") > -1;
  if (isDoc) {
    e.respondWith(
      fetch(req)
        .then(async (res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put("./index.html", copy)).catch(() => {});
            return res;
          }
          return offlinePage();
        })
        .catch(() => offlinePage())
    );
    return;
  }

  // 其它资源：先给缓存（快），后台顺手更新
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
