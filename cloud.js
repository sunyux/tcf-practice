"use strict";
// 登录 → 取题库 → 同步进度 → 启动页面程序
(() => {
  const FS = "https://firestore.googleapis.com/v1/projects/dictation-30ff5/databases/(default)/documents", ROOT = new URL("./", location.href).pathname;
  const KEYS = ["tcf.listening.v1", "tcf.reading.v1", "tcf.writing.v1", "tcf.speaking.v1"], META = "tcf.sync2";
  const me = document.currentScript, BOOT = me.dataset.boot.split(" "), HOME = BOOT.at(-1) === "home.js";
  const app = document.getElementById("app");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const t = localStorage.getItem("tcf.theme");
  document.documentElement.dataset.theme = (t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
  const screen = (html) => { app.innerHTML = `<header><h1>TCF Canada 练习</h1></header><main class="gate">${html}</main>`; };
  screen(`<p class="muted">正在打开…</p>`);

  // ---------- 登录（用单独的 app 名，不影响同域名下的其他网站） ----------
  let user = null, auth = null;
  if (window.firebase && window.FIREBASE_CONFIG) auth = firebase.initializeApp(window.FIREBASE_CONFIG, "tcf").auth();
  const firstUser = auth ? new Promise((res) => { const off = auth.onAuthStateChanged((u) => { off(); res(u); }, () => res(null)); }) : Promise.resolve(null);
  const idToken = async () => (user ? user.getIdToken() : null);
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", async (e) => {
      if (e.data?.tcf !== "token") return;
      const port = e.ports[0];
      await firstUser; port.postMessage(await idToken().catch(() => null));
    });
    navigator.serviceWorker.startMessages();
  }
  const ask = (msg) => new Promise((res) => {
    const ch = new MessageChannel(), timer = setTimeout(() => res({ err: 0, cached: true, slow: true }), 15000);
    ch.port1.onmessage = (e) => { clearTimeout(timer); res(e.data); };
    navigator.serviceWorker.controller.postMessage(msg, [ch.port2]);
  });
  function loginScreen(msg = "") {
    screen(`<p>这是私人练习网站，只有受邀的 Google 账号能打开题库。</p><button class="primary" id="in">用 Google 登录</button>${msg ? `<p class="note">${esc(msg)}</p>` : ""}`);
    document.getElementById("in").onclick = async () => {
      try { await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); location.reload(); }
      catch (e) { loginScreen(/popup/.test(e.code ?? "") ? "登录窗口被关掉或拦住了，请允许弹出窗口再试。" : `登录失败：${e.code ?? e.message}`); }
    };
  }
  async function signOut() {
    if (navigator.serviceWorker.controller) await ask("forget");
    await auth.signOut(); location.href = "index.html";
  }

  // ---------- 进度同步 ----------
  const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const rawSet = Storage.prototype.setItem, set = (k, v) => rawSet.call(localStorage, k, v);
  const meta = () => get(META, { rev: {}, dirty: {} });
  const editMeta = (f) => { const m = meta(); f(m); set(META, JSON.stringify(m)); };
  const stopped = new Set();       // 云端有更新的进度：这页先不再写，刷新时合并
  let timer = 0, last = "", busy = null;
  function merge(a, b) {           // 两边都有改动：对象取并集，列表去重，同一项以本机为准（文字取较长的）
    if (a === undefined) return b;
    if (b === undefined || a === null || b === null) return a;
    if (Array.isArray(a) && Array.isArray(b)) {
      const seen = new Set();
      return [...a, ...b].filter((x) => { const k = JSON.stringify(x); return !seen.has(k) && seen.add(k); }).sort((x, y) => (x?.at ?? 0) - (y?.at ?? 0));
    }
    if (typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b))
      return Object.fromEntries([...new Set([...Object.keys(b), ...Object.keys(a)])].map((k) => [k, merge(a[k], b[k])]));
    if (typeof a === "string" && typeof b === "string") return a.length >= b.length ? a : b;
    return a;
  }
  const api = async (path, opt = {}, base = `tcf_users/${user.uid}/state`) => fetch(`${FS}/${base}${path}`, { ...opt, headers: { ...opt.headers, Authorization: `Bearer ${await idToken()}` } });
  async function cloudState(base) {
    const r = await api("", { signal: AbortSignal.timeout(8000) }, base);
    if (!r.ok) throw new Error(r.status);
    return Object.fromEntries(((await r.json()).documents ?? []).map((d) => [d.name.split("/").pop(), { rev: d.updateTime, value: d.fields.v.stringValue }]));
  }
  const show = (x) => { last = x; const el = document.getElementById("sync"); if (el) el.textContent = x; };
  // 同一台设备换了账号：把上一个人的本机进度收起来，换成自己的
  function switchUser() {
    const m = meta();
    if (m.uid === user.uid) return;
    if (m.uid) {
      set(`tcf.backup.${m.uid}`, JSON.stringify({ m, v: Object.fromEntries(KEYS.map((k) => [k, localStorage.getItem(k)])) }));
      KEYS.forEach((k) => localStorage.removeItem(k));
    }
    const b = m.uid && get(`tcf.backup.${user.uid}`, null);
    if (b) { KEYS.forEach((k) => b.v[k] && set(k, b.v[k])); localStorage.removeItem(`tcf.backup.${user.uid}`); }
    set(META, JSON.stringify(b ? b.m : { uid: user.uid, rev: {}, dirty: {} }));
  }
  async function pull() {
    const cloud = await cloudState();
    if (!Object.keys(cloud).length) {      // 旧版只有一份共用进度（只有主人能读）：搬到自己名下
      const old = await cloudState("tcf_state").catch(() => ({}));
      for (const k of KEYS) if (old[k]) set(k, JSON.stringify(merge(get(k, undefined), JSON.parse(old[k].value))));
    }
    for (const k of KEYS) {
      const c = cloud[k], m = meta(), local = localStorage.getItem(k);
      if (!c) { if (local) editMeta((x) => { x.rev[k] = ""; x.dirty[k] = 1; }); continue; }
      if (c.rev === m.rev[k]) continue;
      const both = local && (m.dirty[k] || !(k in m.rev));
      set(k, both ? JSON.stringify(merge(get(k, {}), JSON.parse(c.value))) : c.value);
      editMeta((x) => { x.rev[k] = c.rev; if (both) x.dirty[k] = 1; else delete x.dirty[k]; });
    }
  }
  const later = () => { clearTimeout(timer); timer = setTimeout(push, 4000); };
  function push(keepalive = false) { clearTimeout(timer); return (busy ??= run(keepalive === true).finally(() => { busy = null; })); }
  async function run(keepalive) {
    for (const k of KEYS) {
      const m = meta(), value = localStorage.getItem(k);
      if (!m.dirty[k] || !value || stopped.has(k) || value.length > 900000) continue;
      try {
        // 版本号对得上才写入，避免两台设备互相覆盖
        const cond = m.rev[k] ? `currentDocument.updateTime=${encodeURIComponent(m.rev[k])}` : "currentDocument.exists=false";
        const r = await api(`/${k}?${cond}`, { method: "PATCH", keepalive: keepalive && value.length < 50000, headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields: { v: { stringValue: value } } }) });
        if (r.status === 409 || r.status === 400 && /FAILED_PRECONDITION|ALREADY_EXISTS/.test(await r.clone().text())) { stopped.add(k); banner(); continue; }
        if (!r.ok) throw new Error(r.status);
        const { updateTime } = await r.json();
        editMeta((x) => { x.rev[k] = updateTime; if (localStorage.getItem(k) === value) delete x.dirty[k]; });
        show("进度已同步");
      } catch { show("没连上，进度先存在这台设备"); return; }
    }
    if (KEYS.some((k) => meta().dirty[k] && !stopped.has(k))) later();
  }
  function banner() {
    if (document.getElementById("syncbar")) return;
    const d = document.createElement("div");
    d.id = "syncbar"; d.setAttribute("role", "status"); d.innerHTML = `另一台设备有新进度 <button>刷新合并</button>`;
    d.querySelector("button").onclick = () => location.reload();
    document.body.append(d);
  }
  async function check() {         // 切回这页时，云端变了就刷新（正在做题只提示）
    if (stopped.size) return;
    try {
      const cloud = await cloudState(), m = meta(), changed = KEYS.filter((k) => cloud[k] && cloud[k].rev !== (m.rev[k] ?? ""));
      if (!changed.length) return;
      if (/^(#\/?)?$/.test(location.hash)) return location.reload();
      changed.forEach((k) => stopped.add(k)); banner();
    } catch { /* 断网 */ }
  }
  function watch() {
    Storage.prototype.setItem = function (k, v) {
      const changed = this === localStorage && KEYS.includes(k) && localStorage.getItem(k) !== String(v);
      rawSet.call(this, k, v);
      if (changed) { editMeta((x) => { x.dirty[k] = 1; }); later(); }
    };
    document.addEventListener("visibilitychange", async () => { if (document.hidden) return void push(true); await busy; check(); });
    addEventListener("pagehide", () => push(true));
    addEventListener("online", () => push());
  }

  // ---------- 启动 ----------
  const script = (src) => new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error(src)); document.body.append(s); });
  const CAPTURE = { L() { window.TCF_L = { tests: TCF_INDEX, levels: TCF_LEVELS, alias: window.TCF_ALIAS ?? {} }; window.TCF_ALIAS = {}; }, R() { window.TCF_R = { tests: TCF_INDEX, levels: TCF_LEVELS, alias: window.TCF_ALIAS ?? {} }; } };
  async function start() {
    if (!("serviceWorker" in navigator) || !("DecompressionStream" in window)) return screen(`<p class="note">这个浏览器太旧或在无痕模式，请换新版 Safari 或 Chrome。</p>`);
    await navigator.serviceWorker.register("sw.js", { updateViaCache: "none" });
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise((res) => { navigator.serviceWorker.addEventListener("controllerchange", res, { once: true }); setTimeout(res, 3000); });
    if (!navigator.serviceWorker.controller) {
      if (sessionStorage.getItem("tcf.reload")) return screen(`<p class="note">页面没有准备好，请关掉这个标签页重新打开。</p>`);
      sessionStorage.setItem("tcf.reload", "1"); return location.reload();
    }
    sessionStorage.removeItem("tcf.reload");
    user = await firstUser;
    if (!user && auth && navigator.onLine) return loginScreen();
    const m = await ask("manifest");
    if (m.err && m.err !== 503 && !(m.err === 404)) {
      if (m.err === 401 && m.cached) { /* 断网时用本机题库 */ } else {
        screen(`<p>${esc(user?.email ?? "")} 没有权限打开题库。</p><p class="muted">请用受邀的那个账号登录，或请主人检查权限。（${esc(m.err)}）</p><button id="out">换一个账号</button>`);
        document.getElementById("out").onclick = signOut; return;
      }
    } else if (m.err === 404) return screen(`<p>题库还没有上传。</p>`);
    else if (m.err !== undefined && !m.cached) return screen(`<p>没有网络，这台设备上也还没有题库。</p>`);
    if (user) switchUser();
    if (user) try { await pull(); show("进度已同步"); } catch { show("没连上，用这台设备上的进度"); }
    watch();
    try { for (const b of BOOT) if (CAPTURE[b]) CAPTURE[b](); else await script(b); }
    catch (e) { return screen(`<p class="note">题库没有读出来，请检查网络后刷新。（${esc(e.message)}）</p>`); }
    if (user) push();
    if (!HOME) return;
    const f = document.createElement("footer");
    f.className = "cloud"; f.innerHTML = `<span class="muted"><span id="sync">${esc(last)}</span>${user ? ` · ${esc(user.email)}` : ""}</span><button id="out">退出登录</button>`;
    document.body.append(f);
    document.getElementById("out").onclick = () => { if (confirm("退出登录会删除这台设备上的题库缓存，做题记录保留。确定吗？")) signOut(); };
  }
  start().catch((e) => screen(`<p class="note">打不开：${esc(e.message)}</p>`));
})();
