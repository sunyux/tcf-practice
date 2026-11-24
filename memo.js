"use strict";
// 背题：每题只记 1–2 个词。进度存在浏览器里（tcf.memo.v1）
const KEY = "tcf.memo.v1", DAY = 86400000, ROUND = 10, GAP = [0, 1, 3, 7, 15, 30];
const SK = { listening: { name: "听力", list: window.TCF_MEMO_L ?? [], verb: "听到", page: "listening.html" }, reading: { name: "阅读", list: window.TCF_MEMO_R ?? [], verb: "看到", page: "reading.html" } };
let store = { mem: {}, easy: true, theme: "" };      // mem: 题目 id → { b: 熟练度, d: 下次复习时间 }
try { Object.assign(store, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch { /* 存档损坏则重新开始 */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* 隐私模式：不保存 */ } };
const app = document.getElementById("app");
const $ = (s) => app.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const LV = ["A1", "A2", "B1", "B2", "C1", "C2"];
let run = null;      // 一轮：{ sk, lv, kind, items, i, stage, queue, again, right, total }

function applyTheme() {
  const t = localStorage.getItem("tcf.theme");
  document.documentElement.dataset.theme = (t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
}
const header = (t, extra = "") => `<header><h1>${esc(t)}</h1>${extra}<button data-act="theme" aria-label="切换深浅色">◐</button></header>`;
// 在选项里标出要记的词（整词，不区分大小写）
function mark(text, word) {
  if (!word) return esc(text);
  const re = new RegExp(`(^|[^\\p{L}\\p{N}-])(${word.split(" ").map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[^\\p{L}\\p{N}]+").replace(/'/g, "['’]")})(?=$|[^\\p{L}\\p{N}-])`, "iu");
  const m = re.exec(text);
  return m ? esc(text.slice(0, m.index + m[1].length)) + `<mark>${esc(m[2])}</mark>` + esc(text.slice(m.index + m[0].length)) : esc(text);
}
const known = (q) => (store.mem[q.id]?.b ?? 0) > 0;
const due = (q) => known(q) && store.mem[q.id].d <= Date.now();
const pool = (sk, lv) => SK[sk].list.filter((q) => lv === "all" || q.l === lv);

// ---------- 首页 ----------
function home() {
  app.innerHTML = header("TCF 背题", `<a href="index.html">← 首页</a>`) + `<main>
    <p>每题只记 1–2 个词，选项里看到就能选对：</p>
    <ul class="how"><li><b>1 个词</b>：整个题库里，凡是有这个词的选项都是对的，看到就选。</li>
      <li><b>2 个词</b>：听到（读到）前一个词，就选带后一个词的选项。</li></ul>
    <label class="muted"><input type="checkbox" id="easy"${store.easy ? " checked" : ""}> 先背只要 1 个词的题</label>
    <div class="hub" style="margin-top:14px">${Object.entries(SK).map(([sk, s]) => {
      const dueN = s.list.filter(due).length, k = s.list.filter(known).length, one = s.list.filter((q) => q.s).length;
      return `<section class="skill"><h2>${s.name} <span class="muted">${s.list.length} 题：${one} 题 1 个词，${s.list.length - one} 题 2 个词</span></h2>
        <div class="row facts"><span class="muted"><b>${k}</b> 背过</span><span class="muted"><b>${dueN}</b> 该复习</span></div>
        <div class="rows">${LV.map((lv) => { const p = pool(sk, lv), n = p.filter(known).length; return `<a class="prow" href="#/${sk}/${lv}"><span class="tag lv-${lv}">${lv}</span><span class="bar"><i style="width:${p.length ? n / p.length * 100 : 0}%"></i></span><span class="muted num">${n}/${p.length}</span></a>`; }).join("")}</div>
        <div class="row">${dueN ? `<a class="btn primary" href="#/${sk}/all/review">复习 ${dueN} 题</a>` : ""}<a class="btn${dueN ? "" : " primary"}" href="#/${sk}/${LV.find((lv) => pool(sk, lv).some((q) => !known(q))) ?? "A1"}/learn">背 ${ROUND} 题</a><a class="btn" href="#/${sk}/all/sheet">速查表</a></div></section>`;
    }).join("")}</div>
    <p class="muted" style="margin-top:18px">只对这个题库有效：考试换了说法或出新题就不灵，听懂读懂仍然最可靠。</p></main>`;
}
function level(sk, lv) {
  const p = pool(sk, lv), n = p.filter(known).length, d = p.filter(due).length, left = p.length - n;
  app.innerHTML = header(`${SK[sk].name} ${lv}`, `<a href="#/">← 背题</a>`) + `<main>
    <div class="summary"><div><b>${p.length}</b><span class="muted">题</span></div><div><b>${n}</b><span class="muted">背过</span></div><div><b>${d}</b><span class="muted">该复习</span></div><div><b>${p.filter((q) => q.s).length}</b><span class="muted">只要 1 个词</span></div></div>
    <div class="row" style="margin-top:16px">
      ${left ? `<a class="btn primary" href="#/${sk}/${lv}/learn">背 ${Math.min(ROUND, left)} 题</a>` : ""}
      ${d ? `<a class="btn${left ? "" : " primary"}" href="#/${sk}/${lv}/review">复习 ${d} 题</a>` : ""}
      <a class="btn" href="#/${sk}/${lv}/test">随机测 20 题</a><a class="btn" href="#/${sk}/${lv}/sheet">速查表</a></div></main>`;
}

// ---------- 背和测 ----------
function start(sk, lv, kind) {
  const p = pool(sk, lv);
  let items;
  if (kind === "learn") { items = p.filter((q) => !known(q)); if (store.easy) items = [...items].sort((a, b) => b.s - a.s || b.m - a.m); items = items.slice(0, ROUND); }
  else if (kind === "review") items = shuffle(p.filter(due)).slice(0, 30);
  else items = shuffle(p).slice(0, 20);
  if (!items.length) return void (location.hash = lv === "all" ? "#/" : `#/${sk}/${lv}`);
  run = { sk, lv, kind, items, stage: kind === "learn" ? "card" : "quiz", i: 0, queue: shuffle(items), missed: new Set(), total: items.length, done: 0 };
  scene();
}
const cueHtml = (q) => (q.s ? `<p class="cue muted">看到就选</p>` : q.c ? `<p class="cue"><span class="muted">${SK[run.sk].verb}</span> <b lang="fr">${esc(q.c)}</b>${q.cz ? ` <span class="muted">${esc(q.cz)}</span>` : ""}</p>` : `<p class="cue muted">${q.img ? "看图" : "看选项"}</p>`);
const media = (q) => `${q.img ? `<img class="qimg" src="${esc(q.img)}" alt="题目图片">` : ""}${q.au ? `<details class="au"><summary>听录音</summary><audio controls preload="none" src="${esc(q.au)}"></audio></details>` : ""}`;
const disputed = (q) => (q.my ? `<p class="note">这题有争议：网站答案是 ${esc(q.k)}，Claude 认为是 ${esc(q.my)}，看解析再决定。</p>` : "");
const back = () => `<a href="${run.lv === "all" ? "#/" : `#/${run.sk}/${run.lv}`}">退出</a>`;
function scene() {
  if (run.stage === "card") return card();
  if (!run.queue.length) return finish();
  quiz(run.queue[0]);
}
function card() {
  const q = run.items[run.i];
  app.innerHTML = header(`记词 ${run.i + 1}/${run.items.length}`, back()) + `<main class="memo"><div class="card">
    <div class="row"><span class="tag lv-${q.l}">${q.l}</span><span class="muted">${esc(q.t.replace("test", "Test "))} Q${q.n}</span><span class="tag${q.s ? "" : " warn"}">${q.s ? "1 个词" : "2 个词"}</span></div>
    ${cueHtml(q)}<p class="word"><span lang="fr">${esc(q.a)}</span> <button class="say" data-say="${esc(q.a)}">读</button><small>${esc(q.az)}</small></p>
    ${q.s && q.m > 1 ? `<p class="muted">题库里有 ${q.m} 题的答案靠这个词</p>` : ""}
    ${q.ask ? `<p class="ask"><span lang="fr">${esc(q.ask)}</span></p>` : ""}${q.img ? media(q) : ""}
    <ul class="memo-opts">${q.o.map(([k, fr, en]) => `<li class="${k === q.k ? "ok" : ""}"><b>${k}</b> <span><span lang="fr">${k === q.k ? mark(fr, q.a) : esc(fr)}</span><small class="muted">${esc(en)}</small></span></li>`).join("")}</ul>
    ${q.key ? `<details><summary>关键句</summary><p lang="fr">${mark(q.key, q.c)}</p></details>` : ""}${q.img ? "" : media(q)}${disputed(q)}</div>
    <div class="nav"><button data-act="prev" ${run.i ? "" : "disabled"}>上一个</button><button class="primary" data-act="next">${run.i + 1 < run.items.length ? "下一个" : "开始测"}</button></div></main>`;
  scrollTo(0, 0);
}
function quiz(q) {
  run.cur = q; run.opts = shuffle(q.o); run.picked = null;
  app.innerHTML = header(`${run.kind === "learn" ? "测一测" : run.kind === "review" ? "复习" : "随机测"} ${run.done}/${run.total}`, back()) + `<main class="memo"><div class="card">
    <div class="row"><span class="tag lv-${q.l}">${q.l}</span></div>${cueHtml(q)}${q.img ? `<img class="qimg" src="${esc(q.img)}" alt="题目图片">` : ""}
    <div class="opts">${run.opts.map(([k, fr], i) => `<button class="opt" data-pick="${esc(k)}"><span class="k">${i + 1}</span><span lang="fr">${esc(fr)}</span></button>`).join("")}</div>
    <div id="after"></div></div></main>`;
  scrollTo(0, 0);
}
function pick(k) {
  const q = run.cur;
  if (run.picked) return;
  run.picked = k;
  const ok = k === q.k, first = !run.missed.has(q.id), m = store.mem[q.id] ?? { b: 0, d: 0 };
  app.querySelectorAll(".opt").forEach((b) => {
    b.disabled = true;
    const o = q.o.find(([x]) => x === b.dataset.pick);
    if (o[0] === q.k) { b.classList.add("ok"); b.lastElementChild.innerHTML = mark(o[1], q.a); } else if (o[0] === k) b.classList.add("no");
  });
  run.queue.shift();
  if (ok) {
    run.done++;
    if (first) { const b = Math.min((m.b || 0) + 1, GAP.length - 1); store.mem[q.id] = { b, d: Date.now() + GAP[b] * DAY }; }
    else store.mem[q.id] = { b: 1, d: Date.now() + DAY };
  } else {
    run.missed.add(q.id); store.mem[q.id] = { b: 0, d: 0 };
    run.queue.splice(Math.min(3, run.queue.length), 0, q);      // 错的隔几题再考
  }
  save();
  $("#after").innerHTML = `<p class="word"><span lang="fr">${esc(q.a)}</span><small>${esc(q.az)}</small></p>${media({ ...q, img: "" })}${disputed(q)}<div class="nav"><span></span><button class="primary" data-act="cont">${run.queue.length ? "下一题" : "看结果"}</button></div>`;
  $("[data-act=cont]").focus();
}
function finish() {
  const wrong = run.items.filter((q) => run.missed.has(q.id)), { sk, lv } = run;
  app.innerHTML = header("这一轮完成", back()) + `<main class="memo"><div class="summary"><div><b>${run.total - wrong.length}/${run.total}</b><span class="muted">一次答对</span></div></div>
    ${wrong.length ? `<h2>再看一眼</h2>${sheetRows(wrong, sk)}` : `<p>全部一次答对。</p>`}
    <div class="row" style="margin-top:16px"><button class="primary" data-act="again">${run.kind === "learn" ? "再背一组" : "再来一轮"}</button><a class="btn" href="${lv === "all" ? "#/" : `#/${sk}/${lv}`}">返回</a></div></main>`;
}

// ---------- 速查表 ----------
const sheetRows = (list, sk) => `<table class="sheet"><thead><tr><th>${SK[sk].verb}</th><th>就选带这个词的</th><th class="z">中文</th><th class="f">正确选项</th></tr></thead><tbody>${list.map((q) => `<tr><td lang="fr">${q.s ? `<span class="muted">—</span>` : q.c ? `${esc(q.c)} <small class="muted">${esc(q.cz)}</small>` : `<span class="muted">${q.img ? "看图" : "看选项"}</span>`}</td><td lang="fr"><b>${esc(q.a)}</b>${q.my ? " ⚠️" : ""}</td><td class="z">${esc(q.az)}</td><td class="f muted" lang="fr">${esc(q.o.find(([k]) => k === q.k)?.[1])}</td></tr>`).join("")}</tbody></table>`;
function sheet(sk, lv) {
  const p = pool(sk, lv), one = p.filter((q) => q.s), two = p.filter((q) => !q.s);
  // 同一个保险词只列一次
  const seen = new Set(), uniq = one.filter((q) => !seen.has(q.a) && seen.add(q.a)).sort((a, b) => b.m - a.m || a.a.localeCompare(b.a, "fr"));
  app.innerHTML = header(`${SK[sk].name} ${lv === "all" ? "" : lv} 速查表`, `<a href="${lv === "all" ? "#/" : `#/${sk}/${lv}`}">← 返回</a>`) + `<main>
    <div class="row noprint"><input id="find" type="search" placeholder="搜索词"><label class="muted"><input type="checkbox" id="hide"> 遮住正确选项</label><button data-act="print">打印</button></div>
    <h2>1 个词：看到就选（${uniq.length} 个词，${one.length} 题）</h2>${sheetRows(uniq, sk)}
    <h2>2 个词（${two.length} 题）</h2>${sheetRows([...two].sort((a, b) => (a.c || "~").localeCompare(b.c || "~", "fr")), sk)}
    ${p.some((q) => q.my) ? `<p class="muted">⚠️ 有争议的题，答案按网站。</p>` : ""}</main>`;
}

// ---------- 事件 ----------
function route() {
  run = null; window.speechSynthesis?.cancel();
  const [, sk, lv, kind] = location.hash.split("/");
  if (!SK[sk]) return home();
  if (lv !== "all" && !LV.includes(lv)) return void (location.hash = "#/");
  if (kind === "sheet") sheet(sk, lv);
  else if (["learn", "review", "test"].includes(kind)) start(sk, lv, kind);
  else if (lv === "all") location.hash = "#/";
  else level(sk, lv);
  scrollTo(0, 0);
}
function say(t) {
  if (!window.speechSynthesis) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(t), v = speechSynthesis.getVoices().find((x) => x.lang.startsWith("fr"));
  u.lang = "fr-FR"; if (v) u.voice = v; u.rate = 0.9; speechSynthesis.speak(u);
}
const acts = {
  theme() { localStorage.setItem("tcf.theme", document.documentElement.dataset.theme === "dark" ? "light" : "dark"); applyTheme(); },
  prev() { if (run.i) { run.i--; card(); } },
  next() { if (run.i + 1 < run.items.length) { run.i++; card(); } else { run.stage = "quiz"; scene(); } },
  cont() { scene(); }, again() { start(run.sk, run.lv, run.kind); }, print() { window.print(); },
};
app.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.act) acts[b.dataset.act](); else if (b.dataset.pick) pick(b.dataset.pick); else if (b.dataset.say) say(b.dataset.say);
});
app.addEventListener("change", (e) => {
  if (e.target.id === "easy") { store.easy = e.target.checked; save(); }
  if (e.target.id === "hide") app.classList.toggle("hidef", e.target.checked);
});
app.addEventListener("input", (e) => {
  if (e.target.id !== "find") return;
  const t = e.target.value.trim().toLowerCase();
  app.querySelectorAll(".sheet tbody tr").forEach((r) => { r.hidden = t && !r.textContent.toLowerCase().includes(t); });
});
addEventListener("keydown", (e) => {
  if (!run || e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.("input,audio,summary")) return;
  if (run.stage === "quiz" && run.cur && !run.picked && /^[1-4]$/.test(e.key) && run.opts[e.key - 1]) pick(run.opts[e.key - 1][0]);
  else if (run.stage === "card" && e.key === "ArrowRight") acts.next(); else if (run.stage === "card" && e.key === "ArrowLeft") acts.prev();
});
addEventListener("hashchange", route);
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
applyTheme(); route();
