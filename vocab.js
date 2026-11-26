"use strict";
// 词汇库：听力+阅读（题里的词）和写作+口语（范文里的词）分开。进度存在浏览器里（tcf.vocab.v1）
const KEY = "tcf.vocab.v1", DAY = 86400000, GAP = [0, 1, 3, 7, 15, 30], PAGE = 100, ROUND = 20;
const D = window.TCF_VOCAB ?? { words: [], phrases: [] };
const LIB = {
  lr: { name: "听力 + 阅读", sub: "题里出现的词", list: D.words.filter((w) => w.n[0] + w.n[1] >= 2), idx: [0, 1], skills: ["听力", "阅读"], ex: "x" },
  ws: { name: "写作 + 口语", sub: "范文例子里的词", list: D.words.filter((w) => w.n[2] + w.n[3] >= 2), idx: [2, 3], skills: ["写作", "口语"], ex: "y" },
  ph: { name: "短语搭配", sub: "听力、阅读题里的固定说法", list: D.phrases, idx: [0, 1], skills: ["听力", "阅读"] },
};
D.phrases.forEach((p) => { p.c ??= ""; });
LIB.ph.ex = "x";
for (const l of Object.values(LIB)) l.list = [...l.list].sort((a, b) => freq(b, l) - freq(a, l) || a.w.localeCompare(b.w, "fr"));
function freq(w, l) { return w.n[l.idx[0]] + w.n[l.idx[1]]; }
const POS = { n: "名词", v: "动词", adj: "形容词", adv: "副词" }, LV = ["A1", "A2", "B1", "B2", "C1", "C2"], TK = ["T1", "T2", "T3"];
let store = { mem: {}, f: {}, s: {}, opt: { n: 20 }, theme: "" };      // mem: 词 → { b: 熟练度（0 = 不认识）, d: 下次复习 }
try { Object.assign(store, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch { /* 存档损坏则重新开始 */ }
for (const k of Object.keys(store.s)) if (!k.includes("#")) delete store.s[k];
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
// 级别：听力、阅读题里最早出现的级别；只在范文里出现的词归 X
const lvOf = (w) => w.lv || "X", lvName = (lv) => (lv === "X" ? "只在范文" : lv === "all" ? "全部" : lv);
// 学和测用的就是词表筛出来的词；每种筛法各存各的进度
const ST = { new: "没标过", no: "不认识", ok: "认识", due: "该复习" };
const sig = () => { const f = flt(); return [f.skill, f.lv, f.pos, f.st, plain(f.q.trim())].join("|"); };
const sid = (kind) => `${lib}#${kind}#${sig()}`, saved = (kind) => { const x = store.s[sid(kind)]; return x && x.q?.length ? x : null; };
function desc() {
  const f = flt(), l = LIB[lib];
  return [f.skill !== "" && l.skills[f.skill], f.lv && (lib === "ws" ? f.lv.replace("T", "Tâche ") : f.lv), f.pos && POS[f.pos], f.st && ST[f.st], f.q.trim() && `“${f.q.trim()}”`].filter(Boolean).join(" · ") || "全部";
}

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
    <h2>词表</h2>
    <div class="row">
      <select data-f="skill" aria-label="来源">${opt("", l.skills.join(" + "), f.skill)}${l.skills.map((s, i) => opt(i, `只看${s}`, f.skill)).join("")}</select>
      <select data-f="lv" aria-label="级别">${opt("", lib === "ws" ? "全部任务" : "全部级别", f.lv)}${(lib === "ws" ? TK : LV).map((x) => opt(x, lib === "ws" ? x.replace("T", "Tâche ") : x, f.lv)).join("")}</select>
      ${lib === "ph" ? "" : `<select data-f="pos" aria-label="词性">${opt("", "全部词性", f.pos)}${Object.entries(POS).map(([k, v]) => opt(k, v, f.pos)).join("")}</select>`}
      <select data-f="st" aria-label="状态">${[["", "全部状态"], ["new", "没标过"], ["no", "不认识"], ["ok", "认识"], ["due", "该复习"]].map(([k, v]) => opt(k, v, f.st)).join("")}</select>
      <select data-f="sort" aria-label="排序">${opt("freq", "按出现次数", f.sort)}${opt("az", "按字母", f.sort)}</select>
      <input id="q" type="search" placeholder="搜法语、中文" value="${esc(f.q)}">
      <span class="vgo" id="go"></span></div>
    <div id="list"></div></main>`;
  list();
}
function row(w) {
  const l = LIB[lib], st = state(w), ex = l.ex ? w[l.ex] : [], k = esc(w.w);
  return `<div class="vrow${st === "ok" ? " known" : ""}" data-w="${k}"><div class="vmain"><button class="say" data-say="${k}" aria-label="读 ${k}">读</button>
      <span class="vw" lang="fr">${article(w)}<b>${k}</b></span>${w.c ? `<span class="muted vpos">${POS[w.c]}</span>` : ""}<span class="vzh">${esc(w.en)}${w.zh ? `<small class="muted">${esc(w.zh)}</small>` : ""}</span>
      <span class="muted vn" title="出现在多少题里">${l.skills.map((s, i) => `${s[0]}${w.n[l.idx[i]]}`).join(" ")}</span>${lib !== "ws" && w.lv ? `<span class="tag lv-${w.lv}">${w.lv}</span>` : ""}
      <span class="vmark"><button data-mark="1" aria-pressed="${st === "ok"}">认识</button><button data-mark="0" aria-pressed="${st === "no"}">不认识</button></span></div>
    ${ex?.length || w.f?.length ? `<details><summary class="muted">例句</summary>${w.f?.length ? `<p class="muted">题里的形式：<span lang="fr">${esc(w.f.join("、"))}</span></p>` : ""}${(ex ?? []).map(([s, tr, ref]) => `<p><span lang="fr">${hi(s, w)}</span> <button class="say" data-say="${esc(s)}">读</button><small class="muted">${tr ? esc(tr) + " · " : ""}${esc(ref)}</small></p>`).join("")}</details>` : ""}</div>`;
}
function hi(s, w) {
  const re = new RegExp(`(^|[^\\p{L}-])(${[w.w, ...(w.f ?? [])].sort((a, b) => b.length - a.length).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?=$|[^\\p{L}-])`, "iu"), m = re.exec(s);
  return m ? esc(s.slice(0, m.index + m[1].length)) + `<mark>${esc(m[2])}</mark>` + esc(s.slice(m.index + m[0].length)) : esc(s);
}
function goBtns(p) {
  const L = saved("learn"), T = saved("test"), fresh = flt().st ? p.length : p.filter((w) => state(w) === "new").length, opt = (n) => `<option value="${n}"${store.opt.n === n ? " selected" : ""}>${n ? `测 ${n} 个` : "测全部"}</option>`;
  return `<a class="btn primary" href="#/${lib}/learn">${L ? `继续学 ${L.d}/${L.t}` : `学<small> ${Math.min(fresh, ROUND)}</small>`}</a><a class="btn" href="#/${lib}/test">${T ? `继续测 ${T.d}/${T.t}` : "测"}</a><select data-o="n" aria-label="测多少个">${[20, 50, 100, 0].map(opt).join("")}</select>`;
}
function list() {
  const p = pool();
  $("#go").innerHTML = goBtns(p);
  $("#list").innerHTML = `<p class="muted">${p.length} 条</p>${p.slice(0, shown).map(row).join("")}${p.length > shown ? `<div class="nav"><span></span><button data-act="more">再显示 ${Math.min(PAGE, p.length - shown)} 条</button></div>` : ""}`;
}
function mark(w, ok, auto) {
  const m = store.mem[w.w] ?? { b: 0, d: 0 };
  const b = ok ? Math.min((m.b || 0) + 1, GAP.length - 1) : 0;
  store.mem[w.w] = { b: auto ? b : ok ? Math.max(b, 2) : 0, d: Date.now() + GAP[auto ? b : ok ? Math.max(b, 2) : 0] * DAY };
  save();
}

// ---------- 学、复习、测（每一步都存，随时退出，下次接着来） ----------
const byName = () => new Map(LIB[lib].list.map((w) => [w.w, w]));
function keep() {
  const x = run;
  if (!x) return;
  if (x.queue.length) store.s[x.key] = { i: x.items.map((w) => w.w), q: x.queue.map((w) => w.w), m: [...x.missed], d: x.done, t: x.total, at: Date.now() };
  else store.s[x.key] = { q: [], at: Date.now() };      // 留个记号，别的设备合并时知道已做完
  save();
}
function start(kind, fresh) {
  const old = !fresh && saved(kind), M = byName(), key = sid(kind), d = desc();
  if (old) {
    const items = old.i.map((w) => M.get(w)).filter(Boolean), queue = old.q.map((w) => M.get(w)).filter(Boolean);
    if (queue.length) { run = { kind, key, desc: d, items, queue, missed: new Set(old.m), done: old.d, total: items.length }; return next(); }
  }
  let p = pool();
  if (kind === "learn") p = (flt().st ? p : p.filter((w) => state(w) === "new")).slice(0, ROUND);      // 没选状态：只学还没标过的
  else { p = shuffle(p.filter((w) => example(w) || w.en)); if (store.opt.n) p = p.slice(0, store.opt.n); }
  if (!p.length) {
    run = null;
    app.innerHTML = header(`${KIND[kind]}`, `<a href="#/${lib}">← 返回</a>`) + `<main class="memo"><p class="muted">${esc(d)}</p><p>${kind === "learn" && !flt().st && pool().length ? "这些词都标过了。可以测，或者把状态选成“不认识”“该复习”再学。" : "没有符合筛选的词，换个筛选再试。"}</p></main>`;
    return;
  }
  run = { kind, key, desc: d, items: p, queue: [...p], missed: new Set(), done: 0, total: p.length };
  keep(); next();
}
const back = () => `<a href="#/${lib}">退出（进度已存）</a>`;
const KIND = { learn: "学词", test: "Meaning quiz" };
const example = (w) => (w[LIB[lib].ex] ?? [])[0] ?? null;
function next() {
  if (!run.queue.length) return finish();
  run.cur = run.queue[0]; run.open = false;
  run.kind === "test" ? quiz() : card();
}
const top_ = () => `<div class="row"><span class="tag ${lvOf(run.cur) !== "X" ? `lv-${lvOf(run.cur)}` : ""}">${lvName(lvOf(run.cur))}</span>${run.cur.c ? `<span class="muted">${POS[run.cur.c]}</span>` : ""}<span class="muted" style="margin-left:auto">${esc(run.desc)}</span></div><div class="bar" style="margin-top:8px"><i style="width:${(run.done / run.total) * 100}%"></i></div>`;
const wordLine = (w) => `<p class="word"><span lang="fr">${article(w)}${esc(w.w)}</span> <button class="say" data-say="${esc(w.w)}">读</button></p>`;
const exLine = (w) => { const x = example(w); return x ? `<p class="exline" lang="fr">${hi(x[0], w)} <button class="say" data-say="${esc(x[0])}">读</button></p>` : ""; };
function card() {
  const w = run.cur, x = example(w);
  app.innerHTML = header(`${KIND[run.kind]} ${run.done}/${run.total}`, back()) + `<main class="memo"><div class="card">${top_()}${wordLine(w)}${exLine(w)}
    <div id="ans" hidden><p class="word" style="font-size:26px">${esc(w.en)}<small>${esc(w.zh ?? "")}</small></p>${x?.[1] ? `<p class="muted">${esc(x[1])}</p>` : ""}${w.f?.length ? `<p class="muted">题里的形式：<span lang="fr">${esc(w.f.join("、"))}</span></p>` : ""}${x ? `<p class="muted">${esc(x[2])}</p>` : ""}</div></div>
    <div class="nav" id="btns"><span></span><button class="primary" data-act="show">看意思</button></div></main>`;
  scrollTo(0, 0);
}
function show() {
  run.open = true; $("#ans").hidden = false;
  $("#btns").innerHTML = `<button data-act="bad">不认识</button><button class="primary" data-act="good">认识</button>`;
}
// 先记录再换下一个：看到答案后马上退出也不会丢
function record(ok) {
  const w = run.queue.shift();
  if (ok) { run.done++; if (!run.missed.has(w.w)) mark(w, true, true); else { store.mem[w.w] = { b: 1, d: Date.now() + DAY }; } }
  else { run.missed.add(w.w); mark(w, false, true); run.queue.splice(Math.min(4, run.queue.length), 0, w); }
  keep();
}
function grade(ok) { record(ok); next(); }
function quiz() {
  const w = run.cur, words = (t) => new Set(plain(t).replace(/\bto\b|\(.*?\)/g, "").match(/[a-z]{3,}/g) ?? []), mine = words(w.en);
  // 干扰项：同词性优先同级别，意思不能和正确答案有相同的词
  const cand = LIB[lib].list.filter((x) => x.w !== w.w && x.c === w.c && x.en && ![...words(x.en)].some((t) => mine.has(t)) && (!w.zh || x.zh !== w.zh));
  const near = shuffle(cand.filter((x) => lvOf(x) === lvOf(w))), rest = shuffle(cand), seen = new Set([w.en]), wrong = [];
  for (const x of [...near, ...rest]) { if (wrong.length === 3) break; if (!seen.has(x.en)) { seen.add(x.en); wrong.push(x); } }
  run.opts = shuffle([w, ...wrong]);
  app.innerHTML = header(`${KIND.test} ${run.done}/${run.total}`, back()) + `<main class="memo"><div class="card">${top_()}${wordLine(w)}${exLine(w)}
    <div class="opts">${run.opts.map((x, i) => `<button class="opt" data-pick="${i}"><span class="k">${i + 1}</span><span lang="en">${esc(x.en)}</span></button>`).join("")}</div><div id="after"></div></div></main>`;
  scrollTo(0, 0);
}
function pick(i) {
  if (run.open) return;
  run.open = true;
  const w = run.cur, ok = run.opts[i] === w, x = example(w);
  app.querySelectorAll(".opt").forEach((b, j) => {
    b.disabled = true;
    if (run.opts[j] === w) b.classList.add("ok"); else if (j === i) b.classList.add("no");
    if (run.opts[j] === w || j === i) b.lastElementChild.innerHTML = `${esc(run.opts[j].en)}<span class="en"><span lang="fr">${esc(run.opts[j].w)}</span>${run.opts[j].zh ? ` ${esc(run.opts[j].zh)}` : ""}</span>`;
  });
  record(ok);
  $("#after").innerHTML = `${x?.[1] ? `<p class="muted">${esc(x[1])}</p>` : ""}${x ? `<p class="muted">${esc(x[2])}</p>` : ""}<div class="nav"><span class="${ok ? "okc" : "badc"}">${ok ? "对了" : "错了，等会儿再考"}</span><button class="primary" data-act="cont">${run.queue.length ? "下一个" : "看结果"}</button></div>`;
  $("#after .primary").focus();
}
function finish() {
  const { items, missed, total, kind, desc: d } = run, bad = items.filter((w) => missed.has(w.w)), left = pool().filter((w) => state(w) === "new").length;
  run = null;
  app.innerHTML = header("这一轮完成", `<a href="#/${lib}">← 返回</a>`) + `<main><div class="summary"><div><b>${total - bad.length}/${total}</b><span class="muted">一次答对</span></div><div><b>${left}</b><span class="muted">还没学的（${esc(d)}）</span></div></div>
    <div class="row" style="margin-top:16px"><button class="primary" data-act="again" data-kind="${kind}">${kind === "learn" ? "再学一组" : "再来一轮"}</button>${kind === "learn" ? `<a class="btn" href="#/${lib}/test">测这些词</a>` : ""}<a class="btn" href="#/${lib}">返回</a></div>
    ${bad.length ? `<h2>还不熟的</h2>${bad.map(row).join("")}` : ""}</main>`;
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
  if (kind === "learn" || kind === "test") start(kind); else home();
  scrollTo(0, 0);
}
// 换了“测多少、测哪些”，没做完的旧测验作废
function delete_tests() { for (const k of Object.keys(store.s)) if (k.includes("#test#") && store.s[k].q?.length) store.s[k] = { q: [], at: Date.now() }; }
const acts = {
  theme() { localStorage.setItem("tcf.theme", document.documentElement.dataset.theme === "dark" ? "light" : "dark"); applyTheme(); },
  more() { shown += PAGE; list(); }, show, good: () => grade(true), bad: () => grade(false), cont: () => next(), again(b) { start(b.dataset.kind, true); },
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
app.addEventListener("change", (e) => { const o = e.target.dataset?.o; if (o) { store.opt[o] = +e.target.value; delete_tests(); save(); return list(); } const k = e.target.dataset?.f; if (k) { flt()[k] = e.target.value; shown = PAGE; save(); list(); } });
app.addEventListener("input", (e) => { if (e.target.id === "q") { flt().q = e.target.value; shown = PAGE; list(); } });
addEventListener("keydown", (e) => {
  if (!run?.cur || e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.("input,select,button,summary")) return;
  if (run.kind === "test") { if (!run.open && /^[1-4]$/.test(e.key) && run.opts[e.key - 1]) pick(e.key - 1); }
  else if (!run.open && (e.key === " " || e.key === "Enter")) { e.preventDefault(); show(); }
  else if (run.open && e.key === "ArrowRight") grade(true); else if (run.open && e.key === "ArrowLeft") grade(false);
});
addEventListener("hashchange", route);
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
applyTheme(); route();
