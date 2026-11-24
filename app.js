"use strict";
// listening（listening.html）或 reading（reading.html）
const READING = window.TCF_SKILL === "reading";
const CFG = READING
  ? { name: "阅读", min: 60, data: "data-reading", key: "tcf.reading.v1",
      nclc: [[549, "10+"], [524, "9"], [499, "8"], [453, "7"], [406, "6"], [375, "5"], [324, "4"]] }
  : { name: "听力", min: 35, data: "data", key: "tcf.listening.v1",
      nclc: [[549, "10+"], [523, "9"], [503, "8"], [458, "7"], [398, "6"], [369, "5"], [331, "4"]] };
// TCF Canada 计分：39 题共 699 分
const points = (n) => (n <= 4 ? 3 : n <= 10 ? 9 : n <= 19 ? 15 : n <= 29 ? 21 : n <= 35 ? 26 : 33);
const nclc = (s) => CFG.nclc.find(([m]) => s >= m)?.[1] ?? "<4";
const KEY = CFG.key;
let store = { practice: {}, level: {}, exams: {}, running: {}, wrong: {}, star: {}, rate: 1, theme: "" };
try { Object.assign(store, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch { /* 存档损坏则重新开始 */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* 隐私模式：不保存 */ } };

const ALIAS = window.TCF_ALIAS ?? {};   // 近似重复题 → 保留的那份
const app = document.getElementById("app");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const title = (id) => (/^test\d+$/.test(id) ? "Test " + id.slice(4) : id.charAt(0).toUpperCase() + id.slice(1));
const $ = (sel) => app.querySelector(sel);
let session = null;   // { kind, id, items:[{tid,q}], answers:{i:key}, pick, i, deadline, done }
let ticker = null;

const loading = {};
function loadTest(id) {
  if (window.TCF_DATA?.[id]) return Promise.resolve(window.TCF_DATA[id]);
  return loading[id] ??= new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = `${CFG.data}/${id}.js`;
    s.onload = () => res(window.TCF_DATA[id]);
    s.onerror = () => { delete loading[id]; rej(new Error(`读取 ${id} 失败`)); };
    document.head.append(s);
  });
}

function applyTheme() {
  const t = localStorage.getItem("tcf.theme") || store.theme;
  const dark = t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}
function toggleTheme() {
  localStorage.setItem("tcf.theme", document.documentElement.dataset.theme === "dark" ? "light" : "dark"); applyTheme();
}
const header = (t, extra = "") => `<header><h1>${esc(t)}</h1>${extra}<button data-act="theme" aria-label="切换深浅色">◐</button></header>`;

// ---------- 首页 ----------
function home() {
  const tests = window.TCF_INDEX ?? [];
  const wrong = Object.keys(store.wrong).length, star = Object.keys(store.star).length;
  const levels = window.TCF_LEVELS ?? {};
  const answered = [...Object.values(store.practice), ...Object.values(store.level)].reduce((s, p) => s + Object.keys(p.answers).length, 0);
  const best = Math.max(0, ...Object.values(store.exams).flat().map((e) => e.score));
  app.innerHTML = header(`TCF ${CFG.name}练习`, `<a href="memo.html">背题</a><a href="index.html">← 首页</a>`) + `<main>
    <div class="summary">
      <div><b>${answered}</b><span class="muted">练习已答</span></div>
      <div><b>${best || "–"}</b><span class="muted">模考最高分${best ? `（NCLC ${nclc(best)}）` : ""}</span></div>
      <div><b>${wrong}</b><span class="muted">错题</span></div>
      <div><b>${star}</b><span class="muted">收藏</span></div>
    </div>
    <div class="row" style="margin-top:14px">
      <button data-go="#/wrong" ${wrong ? "" : "disabled"}>练错题</button>
      <button data-go="#/star" ${star ? "" : "disabled"}>练收藏</button>
      <button data-act="reset">清空记录</button>
    </div>
    <h2>按级别练习</h2>
    <p class="muted">从 ${tests.length} 套里按级别抽出来，重复的题只出现一次，共 ${Object.values(levels).reduce((a, x) => a + x, 0)} 题。</p>
    <div class="tests levels">${Object.entries(levels).map(([lv, count]) => {
      const n = Object.keys(store.level[lv]?.answers ?? {}).filter((u) => !ALIAS[u]).length;
      return `<div class="test"><span class="tag ${lvClass(lv)}">${esc(lv)}</span>
        <div class="bar"><i style="width:${(n / count) * 100}%"></i></div>
        <div class="muted">${n}/${count}</div>
        <div class="row"><button data-go="#/level/${esc(lv)}">${n ? "继续" : "练习"}</button><button data-go="#/viewlevel/${esc(lv)}">看解析</button></div></div>`;
    }).join("")}</div>
    <h2>整套${CFG.name}</h2>
    <div class="tests">${tests.map((t) => {
      const p = store.practice[t.id], n = p ? Object.keys(p.answers).length : 0;
      const ex = store.exams[t.id] ?? [], top = Math.max(0, ...ex.map((e) => e.score));
      return `<div class="test"><strong>${title(t.id)}</strong>
        <div class="bar"><i style="width:${(n / t.count) * 100}%"></i></div>
        <div class="muted">练习 ${n}/${t.count}${ex.length ? ` · 模考 ${top}` : ""}</div>
        <div class="row"><button data-go="#/practice/${t.id}">${n ? "继续" : "练习"}</button>
        ${t.count === 39 ? `<button data-go="#/exam/${t.id}">${store.running[t.id] ? "继续模考" : "模考"}</button>` : ""}
        <button data-go="#/view/${t.id}">看解析</button></div></div>`;
    }).join("")}</div></main>`;
}

// ---------- 做题 ----------
async function start(kind, id) {
  app.innerHTML = header("载入中…");
  const at = location.hash;
  let items;
  if (kind === "practice" || kind === "exam" || kind === "view") {
    const t = (window.TCF_INDEX ?? []).find((x) => x.id === id);
    if (!t || (kind === "exam" && t.count !== 39)) return void (location.hash = "#/");
    items = (await loadTest(id)).map((q) => ({ tid: id, q }));
  } else if (kind === "level" || kind === "viewlevel") {
    if (!window.TCF_LEVELS?.[id]) return void (location.hash = "#/");
    await Promise.all(window.TCF_INDEX.map((t) => loadTest(t.id)));
    const seen = new Set();
    items = window.TCF_INDEX.flatMap((t) => window.TCF_DATA[t.id].map((q) => ({ tid: t.id, q })))
      .filter(({ q }) => q.level === id && !ALIAS[q.id] && !seen.has(q.id) && seen.add(q.id));
  } else {
    const refs = Object.values(store[kind]);
    await Promise.all([...new Set(refs.map((r) => r.t))].map(loadTest));
    items = refs.map((r) => ({ tid: r.t, q: window.TCF_DATA[r.t].find((q) => q.n === r.n) })).filter((x) => x.q);
    if (!items.length) return void (location.hash = "#/");
  }
  if (location.hash !== at) return;   // 载入期间已离开
  session = { kind, id, items, answers: {}, pick: null, i: 0, done: false, view: kind.startsWith("view") };
  if (kind === "practice") {
    const p = (store.practice[id] ??= { answers: {}, i: 0 });
    session.answers = p.answers;
    session.i = p.i;
  }
  if (kind === "level") {
    const p = (store.level[id] ??= { answers: {}, i: 0 });   // 按题目 id 存，不依赖顺序
    items.forEach(({ q }, i) => { if (p.answers[q.id]) session.answers[i] = p.answers[q.id]; });
    session.i = p.i;
  }
  if (kind === "exam") {
    const r = (store.running[id] ??= { answers: {}, i: 0, deadline: Date.now() + CFG.min * 60000 });
    Object.assign(session, { answers: r.answers, i: r.i, deadline: r.deadline });
    save();
    ticker = setInterval(tick, 500);
  }
  shell();
  tick();
}

const sessionTitle = () => ({ practice: `${title(session.id ?? "")} · 练习`, exam: `${title(session.id ?? "")} · 模考`, level: `${session.id} · 跨套练习`, view: `${title(session.id ?? "")} · 看解析`, viewlevel: `${session.id} · 看解析（不重复）`, wrong: "错题本", star: "收藏" }[session.kind]);

function shell() {
  app.innerHTML = header(sessionTitle(),
    `${session.kind === "exam" && !session.done ? '<span class="timer" role="timer"></span><button data-act="finish">交卷</button>' : ""}
     ${session.kind === "practice" || session.kind === "level" ? '<button data-act="redo">重做</button>' : ""}<button data-go="#/">返回</button>`) +
    `<main><div class="layout"><div class="card"><div id="top"></div><div id="body"></div></div>
     <aside class="palette"><span class="muted" id="prog"></span><div id="levels"></div></aside></div></main>`;
  show(session.i);
}

function show(i) {
  const s = session;
  s.i = Math.max(0, Math.min(i, s.items.length - 1));
  s.pick = s.kind === "exam" ? s.answers[s.i] ?? null : null;
  if (s.kind === "practice" || s.kind === "level") { store[s.kind][s.id].i = s.i; save(); }
  if (s.kind === "exam" && !s.done) { store.running[s.id].i = s.i; save(); }
  const { q, tid } = s.items[s.i];
  $("#top").innerHTML = `<div class="row"><strong>第 ${s.i + 1} / ${s.items.length} 题</strong>
      <span class="tag ${lvClass(q.level)}">${esc(q.level)}</span>
      ${!["practice", "exam", "view"].includes(s.kind) ? `<span class="muted">${title(tid)} Q${q.n}</span>` : ""}
      ${q.freq > 1 ? `<span class="muted">出现在 ${q.freq} 套</span>` : ""}
      <span style="flex:1"></span><button data-act="star" aria-pressed="${!!store.star[q.id]}">${store.star[q.id] ? "★ 已收藏" : "☆ 收藏"}</button></div>
    ${READING ? "" : audioHtml(s, q)}`;
  if (!READING) bindAudio(s);
  body();
  palette();
  scrollTo(0, 0);
}

function audioHtml(s, q) {
  return `${q.image ? `<img class="qimg" src="${esc(q.image)}" alt="第 ${s.i + 1} 题图片">` : ""}
    ${q.audio ? `<audio controls preload="metadata" src="${esc(q.audio)}"></audio>` : "<audio hidden></audio>"}
    <div class="note" id="aerr" ${q.audio ? "hidden" : ""}>${q.audio ? "没有找到音频文件。" : "这题没有音频文件。"}</div>
    <div class="row tools"><button data-act="back5">⟲ 5 秒</button>
      ${s.kind === "exam" ? "" : [0.75, 0.9, 1, 1.25].map((r) => `<button class="rate" data-rate="${r}" aria-pressed="${store.rate === r}">${r}×</button>`).join("")}</div>`;
}

function bindAudio(s) {
  const au = $("audio");
  au.addEventListener("error", () => { $("#aerr").hidden = false; });
  au.addEventListener("loadedmetadata", () => { au.playbackRate = s.kind === "exam" ? 1 : store.rate; });
}

// 文章；看答案时把关键句标出来
function passageHtml(q, open) {
  let html = esc(q.passage);
  if (open && q.key[0]) {
    const re = q.key[0].trim().split(/\s+/).map((w) => esc(w).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/&#39;|’/g, "(?:&#39;|’)")).join("\\s+");
    html = html.replace(new RegExp(re, "i"), (m) => `<mark>${m}</mark>`);
  }
  return `<div class="passage">${html}</div><p class="ask"><strong>${esc(q.ask)}</strong>${open ? `<span class="en">${esc(q.askEn)}</span>` : ""}</p>`;
}

function body() {
  const s = session, { q } = s.items[s.i];
  const given = s.answers[s.i];
  const open = s.done || s.view || (s.kind !== "exam" && given);   // 是否显示答案
  const audioOnly = !!q.source;                          // 网站没有选项文字：作答前不剧透
  const opts = q.options.map((o) => {
    const cls = open ? (o.k === q.answer ? " ok" : o.k === given ? " no" : "") : "";
    const fr = open || !audioOnly ? o.fr : "";
    return `<button class="opt${cls}" data-pick="${o.k}" aria-pressed="${!open && s.pick === o.k}" ${open ? "disabled" : ""}>
      <span class="k">${o.k}</span><span>${esc(fr)}${open ? `<span class="en">${esc(o.en)}</span>${o.why ? `<span class="why">${esc(o.why)}</span>` : ""}` : ""}</span></button>`;
  }).join("");
  const last = s.i === s.items.length - 1;
  let mid = "";
  if (!open && s.kind !== "exam") mid = `<button class="primary" data-act="check" ${s.pick ? "" : "disabled"}>确认答案</button>`;
  if (open) mid = review(q, given);
  $("#body").innerHTML = `${READING ? passageHtml(q, open) : ""}<div class="opts">${opts}</div>${mid}
    <div class="nav"><button data-act="prev" ${s.i ? "" : "disabled"}>← 上一题</button>
    ${last && s.kind === "exam" && !s.done ? '<button class="primary" data-act="finish">交卷</button>' : `<button data-act="next" ${last ? "disabled" : ""}>下一题 →</button>`}</div>`;
}

function review(q, given) {
  const sec = (h, inner) => (inner ? `<div class="sec"><h3>${h}</h3>${inner}</div>` : "");
  const p = (t, cls = "") => (t ? `<p class="${cls}">${esc(t)}</p>` : "");
  return `<strong>${session.view ? "" : !given ? "未作答，" : given === q.answer ? "✓ 答对了，" : "✗ 答错了，"}正确答案 ${esc(q.answer)}</strong>
    ${q.voted && q.voted !== q.answer ? `<div class="note">用户投票最多的是 ${esc(q.voted)}，和网站答案不同，请自己判断。</div>` : ""}
    ${q.myNote ? `<div class="mine"><strong>补充解析${q.myAnswer && q.myAnswer !== q.answer ? `：我认为答案是 ${esc(q.myAnswer)}（网站答案 ${esc(q.answer)}）` : ""}</strong><p>${esc(q.myNote)}</p></div>` : ""}
    ${q.source ? `<div class="note">法语选项取自听力转写（${esc(q.source)}），可能有听错的词，以音频为准。</div>` : ""}
    ${READING ? sec("文章翻译", p(q.passageEn)) : sec("原文", p(q.fr) + (q.en ? `<details><summary>英文翻译</summary>${p(q.en, "muted")}</details>` : ""))}
    ${sec("关键句", p(q.key[0]) + p(q.key[1], "muted"))}
    ${sec("解析", p(q.brief) + p(q.explain))}
    ${sec("词汇", q.vocab.length ? `<dl class="vocab">${q.vocab.map(([a, b]) => `<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join("")}</dl>` : "")}`;
}

const lvClass = (lv) => "lv-" + (/^[ABC][12]$/.test(lv) ? lv : "none");

function palette() {
  const s = session;
  const cell = (i) => {
    const { q } = s.items[i], a = s.answers[i], reveal = s.done || s.kind !== "exam";
    const c = a ? (reveal ? (a === q.answer ? "ok" : "no") : "done") : s.done ? "no" : "";
    return `<button data-q="${i}" class="${c}${i === s.i ? " cur" : ""}${store.star[q.id] ? " star" : ""}" aria-label="第 ${i + 1} 题，${esc(q.level)}">${i + 1}</button>`;
  };
  const groups = {};
  s.items.forEach(({ q }, i) => (groups[q.level || "?"] ??= []).push(i));
  $("#levels").innerHTML = Object.keys(groups).sort().map((lv) => `
    <div class="lvhead"><button class="tag ${lvClass(lv)}" data-q="${groups[lv][0]}" aria-label="跳到 ${esc(lv)} 第一题">${esc(lv)}</button>
      <span class="muted">${s.view ? "" : `${groups[lv].filter((i) => s.answers[i]).length}/`}${groups[lv].length}</span></div>
    <div class="grid">${groups[lv].map(cell).join("")}</div>`).join("");
  $("#prog").textContent = s.view ? `共 ${s.items.length} 题` : `已答 ${Object.keys(s.answers).length} / ${s.items.length}`;
}

function record(tid, q, ok) {
  if (ok) delete store.wrong[q.id]; else store.wrong[q.id] = { t: tid, n: q.n };
}

function pick(k) {
  const s = session, { q } = s.items[s.i];
  if (s.done || s.view || (s.kind !== "exam" && s.answers[s.i]) || !q.options.some((o) => o.k === k)) return;
  s.pick = k;
  if (s.kind === "exam") { s.answers[s.i] = k; save(); palette(); }
  body();
}

function check() {
  const s = session;
  if (s.kind === "exam" || s.view || !s.pick || s.answers[s.i]) return;
  const { tid, q } = s.items[s.i];
  s.answers[s.i] = s.pick;
  if (s.kind === "level") store.level[s.id].answers[q.id] = s.pick;
  record(tid, q, s.pick === q.answer);
  save(); body(); palette();
}

// ---------- 模考 ----------
function tick() {
  if (!session || session.kind !== "exam" || session.done) return;
  const left = Math.max(0, Math.ceil((session.deadline - Date.now()) / 1000));
  const el = $(".timer");
  if (el) {
    el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
    el.classList.toggle("low", left < 300);
  }
  if (!left) finish(true);
}

function finish(auto) {
  const s = session;
  if (s.done) return;
  const blank = s.items.length - Object.keys(s.answers).length;
  if (!auto && !confirm(blank ? `还有 ${blank} 题没答，确定交卷？` : "确定交卷？")) return;
  clearInterval(ticker);
  s.done = true;
  let score = 0, correct = 0;
  s.items.forEach(({ tid, q }, i) => {
    const ok = s.answers[i] === q.answer;
    if (ok) { score += points(q.n); correct++; }
    record(tid, q, ok);
  });
  (store.exams[s.id] ??= []).push({ score, correct, at: Date.now() });
  delete store.running[s.id];
  save();
  app.querySelector("audio")?.pause();
  result(score, correct);
}

function result(score, correct) {
  const s = session, by = {};
  s.items.forEach(({ q }, i) => {
    const r = (by[q.level] ??= [0, 0]);
    r[1]++;
    if (s.answers[i] === q.answer) r[0]++;
  });
  app.innerHTML = header(`${title(s.id)} · 成绩`, '<button data-go="#/">返回</button>') + `<main>
    <div class="summary"><div><b>${score} / 699</b><span class="muted">估算分数</span></div>
    <div><b>NCLC ${nclc(score)}</b><span class="muted">估算等级</span></div>
    <div><b>${correct} / ${s.items.length}</b><span class="muted">答对</span></div></div>
    <h2>各级别</h2><table><tr><th>级别</th><th>答对</th><th>总数</th></tr>
    ${Object.entries(by).map(([l, [a, n]]) => `<tr><td>${esc(l)}</td><td>${a}</td><td>${n}</td></tr>`).join("")}</table>
    <p><button class="primary" data-act="review">逐题查看解析</button></p></main>`;
}

// ---------- 事件 ----------
const acts = {
  theme: toggleTheme, check, finish: () => finish(false),
  prev: () => show(session.i - 1), next: () => show(session.i + 1),
  back5: () => { const a = $("audio"); a.currentTime = Math.max(0, a.currentTime - 5); },
  review: () => { session.i = 0; shell(); },
  star() {
    const { tid, q } = session.items[session.i];
    if (store.star[q.id]) delete store.star[q.id]; else store.star[q.id] = { t: tid, n: q.n };
    save();
    const b = $('[data-act="star"]');
    b.textContent = store.star[q.id] ? "★ 已收藏" : "☆ 收藏";
    b.setAttribute("aria-pressed", !!store.star[q.id]);
    palette();
  },
  redo() {
    if (!confirm("清空这里的练习作答，重新开始？")) return;
    app.querySelector("audio")?.pause();
    const { kind, id } = session;
    store[kind][id] = { answers: {}, i: 0 };
    save(); start(kind, id);
  },
  reset() {
    if (!confirm("清空所有练习、模考、错题和收藏？无法恢复。")) return;
    Object.assign(store, { practice: {}, level: {}, exams: {}, running: {}, wrong: {}, star: {} });
    save(); home();
  },
};
app.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  const d = b.dataset;
  if (d.go) location.hash = d.go;
  else if (d.act) acts[d.act]();
  else if (d.pick) pick(d.pick);
  else if (d.q) show(+d.q);
  else if (d.rate) {
    store.rate = +d.rate; save();
    $("audio").playbackRate = store.rate;
    app.querySelectorAll(".rate").forEach((x) => x.setAttribute("aria-pressed", x === b));
  }
});
document.addEventListener("keydown", (e) => {
  if (!session || !$("#body") || e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.("audio,summary,a")) return;
  const k = e.key.toUpperCase();
  if (/^[A-D]$/.test(k)) pick(k);
  else if (/^[1-4]$/.test(k)) pick("ABCD"[k - 1]);
  else if (e.key === "ArrowLeft") show(session.i - 1);
  else if (e.key === "ArrowRight") show(session.i + 1);
  else if (e.key === "Enter" && e.target.tagName !== "BUTTON") check();
  else if (e.key === " " && !READING && e.target.tagName !== "BUTTON") { const a = $("audio"); a.paused ? a.play() : a.pause(); }
  else return;
  e.preventDefault();
});

function route() {
  clearInterval(ticker);
  app.querySelector("audio")?.pause();
  session = null;
  const [, kind, id] = location.hash.split("/");
  if (["practice", "level", "view", "viewlevel", "exam", "wrong", "star"].includes(kind))
    start(kind, id).catch((e) => { app.innerHTML = header("出错了", '<button data-go="#/">返回</button>') + `<main>${esc(e.message)}</main>`; });
  else home();
}
addEventListener("hashchange", route);
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
applyTheme();
route();
