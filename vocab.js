"use strict";
// 词汇库：听力+阅读（题里的词）和写作+口语（范文里的词）分开。进度存在浏览器里（tcf.vocab.v1）
const KEY = "tcf.vocab.v1", DAY = 86400000, GAP = [0, 1, 3, 7, 15, 30], PAGE = 100, ROUND = 20;
const D = window.TCF_VOCAB ?? { words: [], phrases: [] };
const LIB = {
  lr: { name: "听力 + 阅读", sub: "题里出现的词", list: D.words.filter((w) => w.n[0] + w.n[1] >= 2), idx: [0, 1], skills: ["听力", "阅读"], ex: "x" },
  ws: { name: "写作 + 口语", sub: "范文例子里的词", list: D.words.filter((w) => w.n[2] + w.n[3] >= 2), idx: [2, 3], skills: ["写作", "口语"], ex: "y" },
  ph: { name: "短语搭配", sub: "听力、阅读题里的固定说法", list: D.phrases, idx: [0, 1], skills: ["听力", "阅读"] },
};
for (const l of Object.values(LIB)) l.list = [...l.list].sort((a, b) => freq(b, l) - freq(a, l) || a.w.localeCompare(b.w, "fr"));
function freq(w, l) { return w.n[l.idx[0]] + w.n[l.idx[1]]; }
const POS = { n: "名词", v: "动词", adj: "形容词", adv: "副词" }, LV = ["A1", "A2", "B1", "B2", "C1", "C2"], TK = ["T1", "T2", "T3"];
let store = { mem: {}, f: {}, theme: "" };      // mem: 词 → { b: 熟练度（0 = 不认识）, d: 下次复习 }
try { Object.assign(store, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch { /* 存档损坏则重新开始 */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* 隐私模式：不保存 */ } };
const app = document.getElementById("app");
const $ = (s) => app.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const plain = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe").toLowerCase();
const mem = (w) => store.mem[w.w], state = (w) => (!mem(w) ? "new" : mem(w).b ? "ok" : "no"), due = (w) => mem(w) && mem(w).d <= Date.now();
let lib = "lr", shown = PAGE, run = null;
const flt = () => (store.f[lib] ??= { skill: "", lv: "", pos: "", st: "", sort: "freq", q: "" });

function applyTheme() {
  const t = localStorage.getItem("tcf.theme");
  document.documentElement.dataset.theme = (t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
}
const header = (t, extra) => `<header><h1>${esc(t)}</h1>${extra}<button data-act="theme" aria-label="切换深浅色">◐</button></header>`;
const article = (w) => (w.c !== "n" || !w.g ? "" : /^[aeiouhâàéèêëîïôûùüœ]/.test(w.w) ? `<span class="art">${w.g === "m" ? "un" : "une"}</span> ` : `<span class="art">${w.g === "m" ? "le" : "la"}</span> `);
const meaning = (w) => w.zh || w.en;

// ---------- 列表 ----------
function pool() {
  const f = flt(), l = LIB[lib], q = plain(f.q.trim());
  const list = l.list.filter((w) => (f.skill === "" || w.n[l.idx[f.skill]] > 0) && (!f.lv || (lib === "ws" ? w.tk.includes(f.lv) : w.lv === f.lv)) && (!f.pos || w.c === f.pos)
    && (!f.st || (f.st === "due" ? due(w) : state(w) === f.st)) && (!q || plain(`${w.w} ${w.zh ?? ""} ${w.en ?? ""} ${(w.f ?? []).join(" ")}`).includes(q)));
  if (f.skill !== "") list.sort((a, b) => b.n[l.idx[f.skill]] - a.n[l.idx[f.skill]]);
  if (f.sort === "az") list.sort((a, b) => plain(a.w).localeCompare(plain(b.w)));
  return list;
}
function home() {
  const l = LIB[lib], f = flt(), opt = (v, t, cur) => `<option value="${esc(v)}"${String(cur) === String(v) ? " selected" : ""}>${esc(t)}</option>`;
  const cnt = (s) => l.list.filter((w) => state(w) === s).length;
  app.innerHTML = header("TCF 词汇库", `<a href="index.html">← 首页</a>`) + `<main>
    <div class="row tabs">${Object.entries(LIB).map(([k, x]) => `<a class="btn${k === lib ? " primary" : ""}" href="#/${k}">${x.name}</a>`).join("")}</div>
    <p class="muted">${l.sub}，${l.list.length} 条</p>
    <div class="summary"><div><b>${cnt("ok")}</b><span class="muted">认识</span></div><div><b>${cnt("no")}</b><span class="muted">不认识</span></div><div><b>${l.list.filter(due).length}</b><span class="muted">该复习</span></div></div>
    <div class="row" style="margin-top:14px"><a class="btn primary" href="#/${lib}/learn">背 ${ROUND} 个</a>${l.list.some(due) ? `<a class="btn" href="#/${lib}/review">复习</a>` : ""}<a class="btn" href="#/${lib}/test">测 ${ROUND} 个</a></div>
    <h2>词表</h2>
    <div class="row">
      <select data-f="skill" aria-label="来源">${opt("", l.skills.join(" + "), f.skill)}${l.skills.map((s, i) => opt(i, `只看${s}`, f.skill)).join("")}</select>
      <select data-f="lv" aria-label="级别">${opt("", lib === "ws" ? "全部任务" : "全部级别", f.lv)}${(lib === "ws" ? TK : LV).map((x) => opt(x, lib === "ws" ? x.replace("T", "Tâche ") : x, f.lv)).join("")}</select>
      ${lib === "ph" ? "" : `<select data-f="pos" aria-label="词性">${opt("", "全部词性", f.pos)}${Object.entries(POS).map(([k, v]) => opt(k, v, f.pos)).join("")}</select>`}
      <select data-f="st" aria-label="状态">${[["", "全部状态"], ["new", "没标过"], ["no", "不认识"], ["ok", "认识"], ["due", "该复习"]].map(([k, v]) => opt(k, v, f.st)).join("")}</select>
      <select data-f="sort" aria-label="排序">${opt("freq", "按出现次数", f.sort)}${opt("az", "按字母", f.sort)}</select>
      <input id="q" type="search" placeholder="搜法语、中文" value="${esc(f.q)}"></div>
    <div id="list"></div></main>`;
  list();
}
function row(w) {
  const l = LIB[lib], st = state(w), ex = l.ex ? w[l.ex] : [], k = esc(w.w);
  return `<div class="vrow${st === "ok" ? " known" : ""}" data-w="${k}"><div class="vmain"><button class="say" data-say="${k}" aria-label="读 ${k}">读</button>
      <span class="vw" lang="fr">${article(w)}<b>${k}</b></span>${w.c ? `<span class="muted vpos">${POS[w.c]}</span>` : ""}<span class="vzh">${esc(meaning(w))}</span>
      <span class="muted vn" title="出现在多少题里">${l.skills.map((s, i) => `${s[0]}${w.n[l.idx[i]]}`).join(" ")}</span>${lib !== "ws" && w.lv ? `<span class="tag lv-${w.lv}">${w.lv}</span>` : ""}
      <span class="vmark"><button data-mark="1" aria-pressed="${st === "ok"}">认识</button><button data-mark="0" aria-pressed="${st === "no"}">不认识</button></span></div>
    ${ex?.length || w.f?.length || (w.zh && w.en) || w.ref ? `<details><summary class="muted">例句</summary>${w.zh && w.en ? `<p class="muted">${esc(w.en)}</p>` : ""}${w.f?.length ? `<p class="muted">题里的形式：<span lang="fr">${esc(w.f.join("、"))}</span></p>` : ""}${(ex ?? []).map(([s, tr, ref]) => `<p><span lang="fr">${hi(s, w)}</span> <button class="say" data-say="${esc(s)}">读</button><small class="muted">${tr ? esc(tr) + " · " : ""}${esc(ref)}</small></p>`).join("")}${w.ref ? `<p class="muted">${esc(w.ref)}</p>` : ""}</details>` : ""}</div>`;
}
function hi(s, w) {
  const re = new RegExp(`(^|[^\\p{L}-])(${[w.w, ...(w.f ?? [])].sort((a, b) => b.length - a.length).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?=$|[^\\p{L}-])`, "iu"), m = re.exec(s);
  return m ? esc(s.slice(0, m.index + m[1].length)) + `<mark>${esc(m[2])}</mark>` + esc(s.slice(m.index + m[0].length)) : esc(s);
}
function list() {
  const p = pool();
  $("#list").innerHTML = `<p class="muted">${p.length} 条</p>${p.slice(0, shown).map(row).join("")}${p.length > shown ? `<div class="nav"><span></span><button data-act="more">再显示 ${Math.min(PAGE, p.length - shown)} 条</button></div>` : ""}`;
}
function mark(w, ok, auto) {
  const m = store.mem[w.w] ?? { b: 0, d: 0 };
  const b = ok ? Math.min((m.b || 0) + 1, GAP.length - 1) : 0;
  store.mem[w.w] = { b: auto ? b : ok ? Math.max(b, 2) : 0, d: Date.now() + GAP[auto ? b : ok ? Math.max(b, 2) : 0] * DAY };
  save();
}

// ---------- 背词、测词 ----------
function start(kind) {
  let p = pool();
  if (kind === "learn") p = p.filter((w) => state(w) === "new").slice(0, ROUND);
  else if (kind === "review") p = shuffle(LIB[lib].list.filter(due)).slice(0, 30);
  else p = shuffle(p).slice(0, ROUND);
  if (!p.length) return void (location.hash = `#/${lib}`);
  run = { kind, items: p, queue: kind === "test" ? shuffle(p) : [...p], total: p.length, done: 0, missed: new Set() };
  next();
}
const back = () => `<a href="#/${lib}">退出</a>`;
function next() {
  if (!run.queue.length) return finish();
  run.cur = run.queue[0]; run.open = false;
  run.kind === "test" ? quiz() : card();
}
function card() {
  const w = run.cur, ex = LIB[lib].ex ? w[LIB[lib].ex] : [];
  app.innerHTML = header(`${run.kind === "learn" ? "背词" : "复习"} ${run.done}/${run.total}`, back()) + `<main class="memo"><div class="card">
    <p class="word"><span lang="fr">${article(w)}${esc(w.w)}</span> <button class="say" data-say="${esc(w.w)}">读</button>${w.c ? `<small>${POS[w.c]}</small>` : ""}</p>
    ${ex?.[0] ? `<p lang="fr">${hi(ex[0][0], w)}</p>` : ""}
    <div id="ans" hidden><p class="word" style="font-size:26px">${esc(meaning(w))}</p>${w.zh && w.en ? `<p class="muted">${esc(w.en)}</p>` : ""}${ex?.[0]?.[1] ? `<p class="muted">${esc(ex[0][1])}</p>` : ""}${w.f?.length ? `<p class="muted">题里的形式：<span lang="fr">${esc(w.f.join("、"))}</span></p>` : ""}</div></div>
    <div class="nav" id="btns"><span></span><button class="primary" data-act="show">看意思</button></div></main>`;
  scrollTo(0, 0);
}
function show() {
  run.open = true; $("#ans").hidden = false;
  $("#btns").innerHTML = `<button data-act="bad">不认识</button><button class="primary" data-act="good">认识</button>`;
}
function grade(ok) {
  const w = run.queue.shift();
  if (ok) { run.done++; if (!run.missed.has(w.w)) mark(w, true, true); else { store.mem[w.w] = { b: 1, d: Date.now() + DAY }; save(); } }
  else { run.missed.add(w.w); mark(w, false, true); run.queue.splice(Math.min(4, run.queue.length), 0, w); }
  next();
}
function quiz() {
  const w = run.cur, same = LIB[lib].list.filter((x) => x.w !== w.w && x.c === w.c && meaning(x) && meaning(x) !== meaning(w));
  const seen = new Set([meaning(w)]), wrong = [];
  for (const x of shuffle(same)) { if (wrong.length === 3) break; if (!seen.has(meaning(x))) { seen.add(meaning(x)); wrong.push(x); } }
  run.opts = shuffle([w, ...wrong]);
  app.innerHTML = header(`测词 ${run.done}/${run.total}`, back()) + `<main class="memo"><div class="card"><p class="word"><span lang="fr">${article(w)}${esc(w.w)}</span> <button class="say" data-say="${esc(w.w)}">读</button>${w.c ? `<small>${POS[w.c]}</small>` : ""}</p>
    <div class="opts">${run.opts.map((x, i) => `<button class="opt" data-pick="${i}"><span class="k">${i + 1}</span><span>${esc(meaning(x))}</span></button>`).join("")}</div><div id="after"></div></div></main>`;
  scrollTo(0, 0);
}
function pick(i) {
  if (run.open) return;
  run.open = true;
  const ok = run.opts[i] === run.cur, bs = app.querySelectorAll(".opt");
  bs.forEach((b, j) => { b.disabled = true; if (run.opts[j] === run.cur) b.classList.add("ok"); else if (j === i) b.classList.add("no"); });
  const ex = LIB[lib].ex ? run.cur[LIB[lib].ex]?.[0] : null;
  $("#after").innerHTML = `${ex ? `<p lang="fr">${hi(ex[0], run.cur)}</p>` : ""}<div class="nav"><span></span><button class="primary" data-act="${ok ? "good" : "bad"}">下一个</button></div>`;
  $("#after .primary").focus();
}
function finish() {
  const bad = run.items.filter((w) => run.missed.has(w.w)), kind = run.kind;
  app.innerHTML = header("这一轮完成", back()) + `<main><div class="summary"><div><b>${run.total - bad.length}/${run.total}</b><span class="muted">一次答对</span></div></div>
    ${bad.length ? `<h2>还不熟的</h2>${bad.map(row).join("")}` : ""}<div class="row" style="margin-top:16px"><button class="primary" data-act="again" data-kind="${kind}">再来一轮</button><a class="btn" href="#/${lib}">返回词表</a></div></main>`;
}

// ---------- 事件 ----------
function say(t) {
  if (!window.speechSynthesis) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(t), v = speechSynthesis.getVoices().find((x) => x.lang.startsWith("fr"));
  u.lang = "fr-FR"; if (v) u.voice = v; u.rate = 0.9; speechSynthesis.speak(u);
}
function route() {
  window.speechSynthesis?.cancel(); run = null; shown = PAGE;
  const [, a, kind] = location.hash.split("/");
  lib = LIB[a] ? a : "lr";
  if (["learn", "review", "test"].includes(kind)) start(kind); else home();
}
const acts = {
  theme() { localStorage.setItem("tcf.theme", document.documentElement.dataset.theme === "dark" ? "light" : "dark"); applyTheme(); },
  more() { shown += PAGE; list(); }, show, good: () => grade(true), bad: () => grade(false), again(b) { start(b.dataset.kind); },
};
app.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.act) acts[b.dataset.act](b);
  else if (b.dataset.say) say(b.dataset.say);
  else if (b.dataset.pick) pick(+b.dataset.pick);
  else if (b.dataset.mark) {
    const r = b.closest(".vrow"), w = LIB[lib].list.find((x) => x.w === r.dataset.w);
    if (b.getAttribute("aria-pressed") === "true") { delete store.mem[w.w]; save(); } else mark(w, b.dataset.mark === "1");
    r.outerHTML = row(w);
  }
});
app.addEventListener("change", (e) => { const k = e.target.dataset?.f; if (k) { flt()[k] = e.target.value; shown = PAGE; save(); list(); } });
app.addEventListener("input", (e) => { if (e.target.id === "q") { flt().q = e.target.value; shown = PAGE; list(); } });
addEventListener("keydown", (e) => {
  if (!run?.cur || e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.("input,select,button,summary")) return;
  if (run.kind === "test") { if (/^[1-4]$/.test(e.key) && run.opts[e.key - 1]) pick(e.key - 1); }
  else if (!run.open && (e.key === " " || e.key === "Enter")) { e.preventDefault(); show(); }
  else if (run.open && e.key === "ArrowRight") grade(true); else if (run.open && e.key === "ArrowLeft") grade(false);
});
addEventListener("hashchange", route);
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
applyTheme(); route();
