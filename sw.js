"use strict";
// 程序文件走网络（断网用缓存）。data*/ 和 media/ 不在本站，从 Firestore 读（要登录），读过的存在这台设备的 IndexedDB
const FS = "https://firestore.googleapis.com/v1/projects/dictation-30ff5/databases/(default)/documents", SHELL = "tcf-shell-97bd8a2d3c", FILES = ["index.html", "listening.html", "reading.html", "writing.html", "speaking.html", "memo.html", "vocab.html", "app.js", "home.js", "writing.js", "speaking.js", "memo.js", "vocab.js", "style.css", "cloud.js", "firebase-config.js"];
const ROOT = new URL("./", location).pathname;

// ---------- IndexedDB ----------
let dbp = null;
const db = () => (dbp ??= new Promise((res, rej) => {
  const r = indexedDB.open("tcf-files", 1);
  r.onupgradeneeded = () => { r.result.createObjectStore("files"); r.result.createObjectStore("meta"); };
  r.onsuccess = () => { r.result.onversionchange = () => { r.result.close(); dbp = null; }; res(r.result); };
  r.onerror = () => { dbp = null; rej(r.error); };
}));
const idb = async (store, mode, f) => {
  const d = await db();
  return new Promise((res, rej) => { const r = f(d.transaction(store, mode).objectStore(store)); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
};
const get = (s, k) => idb(s, "readonly", (o) => o.get(k));
const put = (s, k, v) => idb(s, "readwrite", (o) => o.put(v, k));

// ---------- Firestore ----------
// 登录凭证只向本站打开的页面要，不保存
async function token(id) {
  const list = [id && await self.clients.get(id), ...await self.clients.matchAll()].filter((c) => c && new URL(c.url).pathname.startsWith(ROOT));
  for (const c of list) {
    const t = await new Promise((res) => {
      const ch = new MessageChannel(), timer = setTimeout(() => res(null), 8000);
      ch.port1.onmessage = (e) => { clearTimeout(timer); res(e.data); };
      c.postMessage({ tcf: "token" }, [ch.port2]);
    });
    if (t) return t;
  }
  throw Object.assign(new Error("没有登录"), { status: 401 });
}
async function doc(id, client) {
  const r = await fetch(`${FS}/tcf_files/${id}`, { headers: { Authorization: `Bearer ${await token(client)}` } });
  if (!r.ok) throw Object.assign(new Error("读取失败"), { status: r.status });
  return (await r.json()).fields;
}
let manifest = null;
async function loadManifest(client, fresh) {
  if (!fresh && (manifest ??= await get("meta", "manifest"))) return manifest;
  const f = await doc("manifest", client);
  manifest = JSON.parse(f.v.stringValue);
  await put("meta", "manifest", manifest);
  return manifest;
}
const bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const pending = new Map();
async function load(rel, client) {
  const m = (await loadManifest(client))[rel];
  if (!m) return null;
  const [id, n, type, gz] = m;
  const hit = await get("files", id);
  if (hit) return { type, buf: hit };
  if (!pending.has(id)) pending.set(id, (async () => {
    const parts = await Promise.all(Array.from({ length: n }, (_, i) => doc(`${id}_${i}`, client).then((f) => bytes(f.d.bytesValue))));
    let blob = new Blob(parts);
    if (gz) blob = await new Response(blob.stream().pipeThrough(new DecompressionStream("gzip"))).blob();
    const buf = await blob.arrayBuffer();
    await put("files", id, buf).catch(() => { /* 空间不够：这次照常用，下次再取 */ });
    return buf;
  })().finally(() => pending.delete(id)));
  return { type, buf: await pending.get(id) };
}
async function local(e, rel) {
  let f;
  try { f = await load(rel, e.clientId); } catch (err) { return new Response("", { status: err.status ?? 503 }); }
  if (!f) return new Response("", { status: 404 });
  const size = f.buf.byteLength, head = { "Content-Type": f.type, "Accept-Ranges": "bytes", "Cache-Control": "no-store" };
  const m = /^bytes=(\d*)-(\d*)$/.exec(e.request.headers.get("range") ?? "");
  if (!m || !(m[1] || m[2])) return new Response(f.buf, { headers: { ...head, "Content-Length": String(size) } });
  const start = m[1] ? +m[1] : Math.max(0, size - +m[2]), end = m[1] && m[2] ? Math.min(+m[2], size - 1) : size - 1;
  if (start >= size || start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  return new Response(f.buf.slice(start, end + 1), { status: 206, headers: { ...head, "Content-Length": String(end - start + 1), "Content-Range": `bytes ${start}-${end}/${size}` } });
}
async function shell(req) {
  const cache = await caches.open(SHELL);
  try {
    const r = await fetch(req);
    if (r.ok || r.type === "opaque") cache.put(req, r.clone());
    return r;
  } catch {
    return (await cache.match(req, { ignoreSearch: true })) ?? new Response("离线，这个页面还没有缓存", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

self.addEventListener("install", (e) => e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES.map((f) => new Request(ROOT + f, { cache: "reload" })))).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys()      // 同一域名下还有别的网站，只清自己的旧缓存
  .then((ks) => Promise.all(ks.filter((k) => k.startsWith("tcf-shell-") && k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("message", (e) => {
  const reply = (v) => e.ports[0]?.postMessage(v);
  if (e.data === "manifest") e.waitUntil(loadManifest(e.source?.id, true).then((m) => reply({ ok: Object.keys(m).length }))
    .catch(async (err) => reply({ err: err.status ?? 0, cached: !!(await get("meta", "manifest").catch(() => null)) })));
  if (e.data === "forget") e.waitUntil((async () => { manifest = null; await idb("files", "readwrite", (o) => o.clear()); await idb("meta", "readwrite", (o) => o.clear()); reply({ ok: 1 }); })());
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (u.origin === "https://www.gstatic.com" && u.pathname.startsWith("/firebasejs/")) return void e.respondWith(shell(e.request));
  if (u.origin !== location.origin || !u.pathname.startsWith(ROOT)) return;
  const rel = decodeURIComponent(u.pathname.slice(ROOT.length));
  e.respondWith(/^(data(-\w+)?|media)\//.test(rel) ? local(e, rel) : shell(e.request));
});
