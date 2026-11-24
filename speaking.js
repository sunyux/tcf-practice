"use strict";
// 口语练习。进度存在浏览器里（tcf.speaking.v1）；录音只留在当前页面，不保存、不上传
const KEY = "tcf.speaking.v1";
const PREP = 120;
const CATS = { "Community / Volunteering": "社区 / 志愿", "Culture / Arts": "文化 / 艺术", "Culture / Events": "文化 / 活动", "Economy / Consumption": "经济 / 消费",
  "Education / Knowledge": "教育 / 知识", "Education / Training": "教育 / 培训", Environment: "环境", "Family / Childcare": "家庭 / 看孩子", "Food / Restaurant": "饮食 / 餐厅",
  General: "综合", "Health / Lifestyle": "健康 / 生活", "Health / Medical": "医疗", "Housing / Neighborhood": "住房 / 街区", "Immigration / Integration": "移民 / 融入",
  "Media / Celebrities": "媒体 / 名人", "Pets / Animals": "宠物 / 动物", "Relationships / Youth": "人际 / 青年", "Shopping / Services": "购物 / 服务",
  "Society / Citizenship": "社会 / 公民", "Sports / Activities": "运动 / 活动", "Travel / Tourism": "旅行 / 旅游", "Work / Career": "工作 / 职业" };
const ALL = window.TCF_SPEAKING ?? [];
const BY = Object.fromEntries(ALL.map((q) => [q.id, q]));
let store = { done: {}, star: {}, filter: { set: "uniq", task: 0, cat: "", state: "", text: "" }, rec: true, theme: "" };
try {
  const old = JSON.parse(localStorage.getItem(KEY) || "{}");
  Object.assign(store, old, { filter: { ...store.filter, ...old.filter } });
} catch { /* 存档损坏则重新开始 */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* 隐私模式：不保存 */ } };

const app = document.getElementById("app");
const $ = (s, el = app) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function applyTheme() {
  const t = localStorage.getItem("tcf.theme") || store.theme;
  const dark = t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}
const header = (t, extra = "") => `<header><h1>${esc(t)}</h1>${extra}<button data-act="theme" aria-label="切换深浅色">◐</button></header>`;
const tag = (t) => `<span class="tag t${t}">Tâche ${t}</span>`;

// ---------- 列表 ----------
function pool() {
  const f = store.filter, text = f.text.trim().toLowerCase();
  return ALL.filter((q) => (f.set === "all" || (f.set === "quick" ? q.quick : q.keep === q.id)) && (!f.task || q.task === f.task) && (!f.cat || q.cat === f.cat)
    && (!f.state || (f.state === "star" ? store.star[q.id] : f.state === "done" ? store.done[q.id] : !store.done[q.id]))
    && (!text || `${q.id} ${q.title} ${q.prompt}`.toLowerCase().includes(text)));
}
function home() {
  const f = store.filter, uniq = ALL.filter((q) => q.keep === q.id).length, quick = ALL.filter((q) => q.quick).length, n = (o) => Object.keys(o).length;
  const btn = (k, v, l) => `<button data-set="${k}" data-val="${v}" aria-pressed="${String(f[k]) === String(v)}" class="rate">${l}</button>`;
  app.innerHTML = header("TCF 口语练习", `<a href="index.html">← 首页</a>`) + `<main>
    <div class="summary">
      <div><b>${uniq}</b><span class="muted">不重复的题（共 ${ALL.length}）</span></div>
      <div><b>${n(store.done)}</b><span class="muted">练过</span></div>
      <div><b>${n(store.star)}</b><span class="muted">收藏</span></div>
    </div>
    <div class="row" style="margin-top:14px">
      <button class="primary" data-act="mock">模考：随机 Tâche 2 + 3</button><button data-act="random">从下面随机抽一题</button>
    </div>
    <h2>题目</h2>
    <div class="row">${btn("set", "quick", `快速套 ${quick}`)}${btn("set", "uniq", `不重复 ${uniq}`)}${btn("set", "all", `全部 ${ALL.length}`)}</div>
    <div class="row" style="margin-top:8px">${btn("task", 0, "两种任务")}${btn("task", 2, "Tâche 2 提问")}${btn("task", 3, "Tâche 3 观点")}</div>
    <div class="row" style="margin-top:8px">
      <select id="cat" aria-label="类别"><option value="">全部类别</option>${Object.entries(CATS).filter(([k]) => ALL.some((q) => q.cat === k)).map(([k, v]) => `<option value="${esc(k)}"${f.cat === k ? " selected" : ""}>${v}</option>`).join("")}</select>
      <select id="state" aria-label="状态">${[["", "全部状态"], ["todo", "没练过"], ["done", "练过"], ["star", "收藏"]].map(([k, v]) => `<option value="${k}"${f.state === k ? " selected" : ""}>${v}</option>`).join("")}</select>
      <input id="text" type="search" placeholder="搜索法语或中文" value="${esc(f.text)}">
    </div>
    <div id="list"></div></main>`;
  list();
}
function list() {
  const qs = pool();
  $("#list").innerHTML = `<p class="muted">${qs.length} 题</p>` + (qs.map((q) => `<a class="wcard" href="#/q/${q.id}">
    <span class="row">${tag(q.task)}<span class="muted">${q.id} · ${esc(CATS[q.cat] ?? q.cat)}</span>${q.quick ? `<span class="tag warn">快速套</span>` : ""}
      ${store.done[q.id] ? `<span class="tag">练过</span>` : ""}${store.star[q.id] ? `<span class="warnc">★</span>` : ""}</span>
    <strong>${esc(q.title)}</strong><span class="fr">${esc(q.prompt)}</span></a>`).join("") || `<p>没有符合条件的题。</p>`);
}

// ---------- 题目 ----------
const answer = (q) => (q.task === 2 ? `<ol class="qs" lang="fr">${q.qs.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>` : `<p lang="fr">${esc(q.text)}</p>`);
const plain = (q) => (q.task === 2 ? q.qs.join(" ") : q.text);
function refHtml(q) {
  const sec = (t, html, text, sub = "") => `<div class="sec"><h3>${t} ${sub ? `<span class="muted">${sub}</span>` : ""} <button class="say" data-say="${esc(text)}">朗读</button></h3>${html}</div>`;
  const size = (x) => (x.task === 2 ? `${x.qs.length} 个问题` : `${x.n} 词`);
  const mine = q.mine ? (Array.isArray(q.mine) ? `<ol class="qs" lang="fr">${q.mine.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>` : `<p lang="fr">${esc(q.mine)}</p>`) : "";
  return `${q.note ? `<div class="mine"><strong>补充说明</strong><p>${esc(q.note)}</p></div>` : ""}
    ${mine ? sec("补充参考（Claude 写的）", mine, Array.isArray(q.mine) ? q.mine.join(" ") : q.mine) : ""}
    ${q.wrong ? `<details class="sec"><summary>网站的参考（答非所问）</summary>${answer(q)}</details>` : sec("网站参考", answer(q), plain(q), size(q))}
    ${q.others.map((i) => { const o = BY[i]; return q.wrong && !q.mine && i === q.others[0] ? sec(`重复题 ${i} 的参考`, answer(o), plain(o), size(o))
      : `<details class="sec"><summary>重复题 ${i} 的参考（${size(o)}）</summary>${o.note ? `<div class="mine"><p>${esc(o.note)}</p></div>` : ""}${answer(o)}</details>`; }).join("")}`;
}
const card = (q) => `<div class="card mockq" data-q="${q.id}">
    <div class="row">${tag(q.task)}<span class="muted">${q.id} · ${esc(CATS[q.cat] ?? q.cat)}${q.same.length ? ` · 另有 ${q.same.length} 道重复题` : ""}</span></div>
    <div class="passage">${esc(q.prompt)}</div>
    <div class="row"><button data-say="${esc(q.prompt)}">读题</button></div>
    <details><summary>中文题意</summary><p>${esc(q.title)}</p></details>
    ${q.quick ? `<details><summary>速记模板</summary><ul lang="fr">${q.quick.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul><p class="muted">${esc(q.quick.tip)}</p></details>` : ""}
    <div class="speak"><span class="clock">${q.task === 2 ? `准备 ${mmss(PREP)} + 说 ${mmss(q.sec)}` : `说 ${mmss(q.sec)}`}</span>
      <div class="row"><button class="primary" data-act="go">开始</button><button data-act="skip" hidden>不准备了，开始说</button><button data-act="stop" hidden>结束</button>
      <label class="muted"><input type="checkbox" data-rec${store.rec ? " checked" : ""}> 录音</label></div>
      <p class="muted msg"></p><div class="play"></div></div>
    <div class="row"><button data-act="ref">看参考</button><button data-act="done">${store.done[q.id] ? "取消练过" : "标记练过"}</button>
      <button data-act="star">${store.star[q.id] ? "★ 已收藏" : "☆ 收藏"}</button></div>
    <div class="ref" hidden></div></div>`;
function question(id) {
  const q = BY[id];
  if (!q) return void (location.hash = "#/");
  const qs = pool(), i = qs.indexOf(q), a = qs[i - 1], b = i >= 0 && qs[i + 1];
  app.innerHTML = header(q.title, `<a href="#/">← 列表</a>`) + `<main>${card(q)}
    <div class="nav"><button data-go="${a ? `#/q/${a.id}` : ""}" ${a ? "" : "disabled"}>上一题</button><button data-go="${b ? `#/q/${b.id}` : ""}" ${b ? "" : "disabled"}>下一题</button></div></main>`;
  scrollTo(0, 0);
}
function mock(a, b) {
  if (!BY[a] || !BY[b]) return void (location.hash = "#/");
  app.innerHTML = header("口语模考", `<a href="#/">← 列表</a>`) + `<main><p class="muted">Tâche 1 是自我介绍（约 2 分钟，没有准备时间），这里从 Tâche 2 开始。</p>${card(BY[a])}${card(BY[b])}
    <div class="row"><button data-act="mock">再抽一组</button></div></main>`;
  scrollTo(0, 0);
}

// ---------- 计时和录音 ----------
let run = null;   // { el, q, phase, end, timer, rec, chunks, stream }
function halt() {
  const r = run; run = null;
  if (!r) return;
  clearInterval(r.timer);
  if (r.rec?.state === "recording") r.rec.stop(); else r.stream?.getTracks().forEach((t) => t.stop());
  if (!r.el.isConnected) return;
  $("[data-act=go]", r.el).hidden = false; $("[data-act=go]", r.el).textContent = "重新开始";
  $("[data-act=skip]", r.el).hidden = $("[data-act=stop]", r.el).hidden = true;
  $(".clock", r.el).classList.remove("low");
}
function phase(r, name, sec) {
  r.phase = name; r.end = Date.now() + sec * 1000;
  $("[data-act=skip]", r.el).hidden = name !== "prep";
  if (name === "speak") record(r);
}
function tick(r) {
  if (run !== r) return;
  const left = Math.max(0, Math.ceil((r.end - Date.now()) / 1000)), c = $(".clock", r.el);
  c.textContent = `${r.phase === "prep" ? "准备" : "说"} ${mmss(left)}`;
  c.classList.toggle("low", r.phase === "speak" && left <= 30);
  if (left) return;
  if (r.phase === "prep") phase(r, "speak", r.q.sec);
  else { c.textContent = "时间到"; finish(r); }
}
function finish(r) { store.done[r.q.id] = 1; save(); $("[data-act=done]", r.el).textContent = "取消练过"; halt(); }
function go(el) {
  halt(); speechSynthesis?.cancel();
  const q = BY[el.dataset.q], r = run = { el, q, chunks: [] };
  $(".play", el).innerHTML = ""; $(".msg", el).textContent = "";
  $("[data-act=go]", el).hidden = true; $("[data-act=stop]", el).hidden = false;
  if (q.task === 2) phase(r, "prep", PREP); else phase(r, "speak", q.sec);
  r.timer = setInterval(() => tick(r), 250); tick(r);
}
async function record(r) {
  if (!store.rec) return;
  const msg = $(".msg", r.el);
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (run !== r) return stream.getTracks().forEach((t) => t.stop());
    r.stream = stream; r.rec = new MediaRecorder(stream);
    r.rec.ondataavailable = (e) => r.chunks.push(e.data);
    r.rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (!r.el.isConnected) return;
      const url = URL.createObjectURL(new Blob(r.chunks, { type: r.rec.mimeType }));
      $(".play", r.el).innerHTML = `<audio controls src="${url}"></audio><p class="muted">录音只留在这个页面，离开后就没了。</p>`;
      msg.textContent = "";
    };
    r.rec.start(); msg.textContent = "● 正在录音";
  } catch { msg.textContent = "没能打开麦克风，只计时。请在浏览器里允许使用麦克风。"; }
}
function say(text) {
  if (!window.speechSynthesis) return;
  if (speechSynthesis.speaking) return speechSynthesis.cancel();
  const voice = speechSynthesis.getVoices().find((v) => v.lang === "fr-CA") ?? speechSynthesis.getVoices().find((v) => v.lang.startsWith("fr"));
  // 太长的文本分句读，避免浏览器中途停止
  for (const s of text.match(/[^.!?]+[.!?]*/g) ?? []) {
    const u = new SpeechSynthesisUtterance(s); u.lang = "fr-FR"; if (voice) { u.voice = voice; u.lang = voice.lang; } u.rate = 0.95;
    speechSynthesis.speak(u);
  }
}

// ---------- 事件 ----------
function route() {
  halt(); window.speechSynthesis?.cancel();
  const [, a, b, c] = location.hash.split("/");
  if (a === "q") question(b); else if (a === "mock") mock(b, c); else home();
}
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const toggle = (o, id) => { if (o[id]) delete o[id]; else o[id] = 1; save(); };
const acts = {
  theme() { localStorage.setItem("tcf.theme", document.documentElement.dataset.theme === "dark" ? "light" : "dark"); applyTheme(); },
  mock() {
    const of = (t) => { const all = ALL.filter((q) => q.task === t && q.keep === q.id), fresh = all.filter((q) => !store.done[q.id]); return pick(fresh.length ? fresh : all).id; };
    location.hash = `#/mock/${of(2)}/${of(3)}`;
  },
  random() { const qs = pool(), fresh = qs.filter((q) => !store.done[q.id]); if (qs.length) location.hash = `#/q/${pick(fresh.length ? fresh : qs).id}`; },
  go(b, el) { go(el); },
  skip() { if (run) { phase(run, "speak", run.q.sec); tick(run); } },
  stop() { if (run) { const r = run; $(".clock", r.el).textContent = "已结束"; if (r.phase === "speak") finish(r); else halt(); } },
  ref(b, el) {
    const d = $(".ref", el); if (!d.innerHTML) d.innerHTML = refHtml(BY[el.dataset.q]);
    d.hidden = !d.hidden; b.textContent = d.hidden ? "看参考" : "收起参考";
  },
  done(b, el) { toggle(store.done, el.dataset.q); b.textContent = store.done[el.dataset.q] ? "取消练过" : "标记练过"; },
  star(b, el) { toggle(store.star, el.dataset.q); b.textContent = store.star[el.dataset.q] ? "★ 已收藏" : "☆ 收藏"; },
};
app.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.go) location.hash = b.dataset.go;
  else if (b.dataset.act) acts[b.dataset.act](b, b.closest("[data-q]"));
  else if (b.dataset.say !== undefined) say(b.dataset.say);
  else if (b.dataset.set) { store.filter[b.dataset.set] = b.dataset.set === "task" ? +b.dataset.val : b.dataset.val; save(); home(); }
});
app.addEventListener("input", (e) => { if (e.target.id === "text") { store.filter.text = e.target.value; save(); list(); } });
app.addEventListener("change", (e) => {
  const t = e.target, f = store.filter;
  if (t.matches("[data-rec]")) { store.rec = t.checked; save(); app.querySelectorAll("[data-rec]").forEach((x) => { x.checked = t.checked; }); return; }
  if (t.id === "cat") f.cat = t.value; else if (t.id === "state") f.state = t.value; else return;
  save(); list();
});
addEventListener("hashchange", route);
addEventListener("pagehide", halt);
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
applyTheme(); route();
