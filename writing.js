"use strict";
// 写作练习。草稿、收藏、模考都存在浏览器里（tcf.writing.v1）
const KEY = "tcf.writing.v1";
const RANGE = { 1: [60, 120], 2: [120, 150], 3: [120, 180] };
const MOCK_MIN = 60;
const CATS = { "Work / Career": T("工作 / 职业"), "Education / Studies": T("教育 / 学习"), "Food / Shopping": T("饮食 / 购物"), "Housing / Living": T("住房 / 生活"),
  "Invitation / Social": T("邀请 / 社交"), "Society / Debate": T("社会 / 讨论"), "Sports / Health": T("运动 / 健康"), "Technology / Digital": T("科技 / 数字"),
  "Transport / Mobility": T("交通 / 出行"), "Travel / Vacation": T("旅行 / 度假"), "Culture / Arts": T("文化 / 艺术"), Other: T("其他") };
// 中文短标题只在中文界面显示；英文、法文界面用任务号代替
const ttl = (q) => (T.lang() === "zh" ? q.title : `Tâche ${q.task} · ${q.no}`);
const CHARS = ["é", "è", "ê", "à", "â", "ç", "ù", "û", "î", "ï", "ô", "œ", "É", "À", "«", "»", "’"];
const ALL = window.TCF_WRITING ?? [];
const BY = Object.fromEntries(ALL.map((q) => [q.id, q]));
let store = { drafts: {}, done: {}, star: {}, mocks: [], running: null, filter: { task: 0, cat: "", uniq: true, state: "", text: "" }, theme: "" };
try {
  const old = JSON.parse(localStorage.getItem(KEY) || "{}");
  Object.assign(store, old, { filter: { ...store.filter, ...old.filter } });
} catch { /* 存档损坏则重新开始 */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* 隐私模式：不保存 */ } };

const app = document.getElementById("app");
const $ = (s) => app.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// 考试计词：两个空格之间算一个词，单独的标点不算
const words = (s) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
let ticker = null, lastField = null;

function applyTheme() {
  const t = localStorage.getItem("tcf.theme") || store.theme;
  const dark = t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}
const header = (t, extra = "") => `<header><h1>${esc(t)}</h1>${extra}<button data-act="theme" aria-label="${T("切换深浅色")}">◐</button></header>`;
const tag = (t) => `<span class="tag t${t}">Tâche ${t}</span>`;
const range = (t) => RANGE[t].join("–") + " " + T("词") + "";

// ---------- 列表 ----------
function pool() {
  const f = store.filter, text = f.text.trim().toLowerCase();
  return ALL.filter((q) => (!f.uniq || q.keep === q.id) && (!f.task || q.task === f.task) && (!f.cat || q.cat === f.cat)
    && (!f.state || (f.state === "star" ? store.star[q.id] : f.state === "done" ? store.done[q.id] : f.state === "todo" ? !store.done[q.id] : store.drafts[q.id]))
    && (!text || [q.no, q.title, q.heading, q.prompt, q.zh, ...q.docs].join(" ").toLowerCase().includes(text)))
    .sort((a, b) => a.task - b.task || ALL.indexOf(a) - ALL.indexOf(b));
}
function home() {
  const uniq = ALL.filter((q) => q.keep === q.id), f = store.filter, n = (o) => Object.keys(o).length;
  const btn = (v, l) => `<button data-task="${v}" aria-pressed="${f.task === v}" class="rate">${l}</button>`;
  app.innerHTML = header(T("TCF 写作练习"), `<a href="index.html">${T("← 首页")}</a>`) + `<main>
    <div class="summary">
      <div><b>${uniq.length}</b><span class="muted">${T("不重复的题（共")} ${ALL.length}${T("）")}</span></div>
      <div><b>${n(store.done)}</b><span class="muted">${T("写完")}</span></div>
      <div><b>${n(store.drafts)}</b><span class="muted">${T("有草稿")}</span></div>
      <div><b>${n(store.star)}</b><span class="muted">${T("收藏")}</span></div>
    </div>
    <div class="row" style="margin-top:14px">
      <button class="primary" data-go="#/mock">${store.running ? T("继续模考") : T("模考：随机三题 60 分钟")}</button>
      ${store.mocks.length ? `<button data-go="#/mocks">${T("模考记录（")}${store.mocks.length}${T("）")}</button>` : ""}
    </div>
    <h2>${T("题目")}</h2>
    <div class="row">${btn(0, T("全部"))}${[1, 2, 3].map((t) => btn(t, `Tâche ${t}`)).join("")}
      <select id="cat" aria-label="${T("类别")}"><option value="">${T("全部类别")}</option>${Object.entries(CATS).filter(([k]) => ALL.some((q) => q.cat === k)).map(([k, v]) => `<option value="${esc(k)}"${f.cat === k ? " selected" : ""}>${v}</option>`).join("")}</select>
      <select id="state" aria-label="${T("状态")}">${[["", T("全部状态")], ["todo", T("没写完")], ["draft", T("有草稿")], ["done", T("写完")], ["star", T("收藏")]].map(([k, v]) => `<option value="${k}"${f.state === k ? " selected" : ""}>${v}</option>`).join("")}</select>
      <input id="text" type="search" placeholder="${T("搜索法语或中文")}" value="${esc(f.text)}">
      <label class="muted"><input id="uniq" type="checkbox"${f.uniq ? " checked" : ""}> ${T("去掉重复题")}</label>
    </div>
    <div id="list"></div></main>`;
  list();
}
function list() {
  const qs = pool();
  $("#list").innerHTML = `<p class="muted">${qs.length} ${T("题")}</p>` + (qs.map((q) => `<a class="wcard" href="#/q/${q.id}">
    <span class="row">${tag(q.task)}<span class="muted">${esc(q.no)} · ${esc(CATS[q.cat])}</span>
      ${store.done[q.id] ? `<span class="tag">${T("写完")}</span>` : store.drafts[q.id] ? `<span class="tag warn">${T("草稿")}</span>` : ""}${store.star[q.id] ? `<span class="warnc">★</span>` : ""}</span>
    ${T.lang() === "zh" ? `<strong>${esc(q.title)}</strong>` : ""}<span class="fr">${esc(q.heading || q.prompt)}</span></a>`).join("") || `<p>${T("没有符合条件的题。")}</p>`);
}

// ---------- 题目 ----------
function promptHtml(q) {
  const docs = q.docs.map((d, i) => `<div class="passage"><strong>Document ${i + 1}</strong>\n${esc(d)}</div>`).join("");
  const zh = [q.zh, ...q.points.map((p, i) => `${T("资料")} ${i + 1}${T("：")}${p}`)].filter(Boolean).join("\n");
  return `${q.prompt ? `<div class="passage">${esc(q.prompt)}</div>` : ""}${q.heading ? `<p class="ask"><strong>${esc(q.heading)}</strong></p>` : ""}${docs}
    ${zh ? `<details><summary>${T("中文意思")}</summary><p class="pre">${esc(zh)}</p></details>` : ""}
    <p class="muted">${T("要求")} ${range(q.task)}${q.task === 3 ? T("：先用 40–60 词概述两份资料，再用 80–120 词写自己的观点") : ""}</p>`;
}
const editor = (q, text) => `<div class="chars">${CHARS.map((c) => `<button type="button" data-char="${c}" aria-label="${T("插入")} ${c}">${c}</button>`).join("")}</div>
  <textarea data-q="${q.id}" spellcheck="false" lang="fr" placeholder="Écrivez votre réponse ici…" aria-label="${T("作答")}">${esc(text)}</textarea>
  <p class="muted count" data-count="${q.id}"></p>`;
function count(q, text) {
  const n = words(text), [lo, hi] = RANGE[q.task], el = $(`[data-count="${q.id}"]`);
  if (!el) return;
  el.textContent = `${n} ${T("词 · 要求")} ${lo}–${hi}` + (n && n < lo ? `${T("，还差")} ${lo - n}` : n > hi ? `${T("，多了")} ${n - hi}` : "");
  el.classList.toggle("bad", n > hi);
}
function modelHtml(q) {
  const box = (t, text, sub = "") => `<div class="sec"><h3>${t}${sub ? ` <span class="muted">${sub}</span>` : ""}</h3><p lang="fr">${esc(text)}</p></div>`;
  const sub = (x) => `${x.n} ${T("词")}${x.parts.length ? `${T("：概述")} ${x.parts[0]} ${T("+ 观点")} ${x.parts[1]}` : ""}`;
  const notes = [T.pick(q, "note"), q.len ? `${T("这篇范文词数不合要求：")}${T.pick(q, "len")}${T("。")}` : ""].filter(Boolean);
  return `${q.answer ? box(T("范文"), q.answer, sub(q)) : ""}
    ${notes.length ? `<div class="mine"><strong>${T("补充说明")}</strong>${notes.map((n) => `<p>${esc(n)}</p>`).join("")}</div>` : ""}
    ${q.mine ? box(T("补充范文（Claude 写的）"), q.mine, `${q.mineN} ${T("词")}`) : ""}
    ${q.others.map((i) => box(`${T("重复题")} ${BY[i].no} ${T("的范文")}`, BY[i].answer, sub(BY[i])) + (BY[i].note ? `<div class="mine"><p>${esc(T.pick(BY[i], "note"))}</p></div>` : "")).join("")}`;
}
function question(id) {
  const q = BY[id];
  if (!q) return void (location.hash = "#/");
  const qs = pool(), i = qs.indexOf(q);
  app.innerHTML = header(ttl(q), `<a href="#/">${T("← 列表")}</a>`) + `<main><div class="card">
    <div class="row">${tag(q.task)}<span class="muted">${esc(q.no)} · ${esc(CATS[q.cat])}${q.same.length ? ` ${T("· 与")} ${q.same.join(T("、"))} ${T("重复")}` : ""}</span></div>
    ${promptHtml(q)}${editor(q, store.drafts[id] ?? "")}
    <div class="row"><button class="primary" data-act="model">${T("看范文")}</button>
      <button data-act="done">${store.done[id] ? T("取消写完") : T("标记写完")}</button>
      <button data-act="star">${store.star[id] ? T("★ 已收藏") : T("☆ 收藏")}</button><button data-act="copy">${T("复制我的作文")}</button></div>
    <div id="model" hidden></div></div>
    <div class="nav"><button data-go="${i > 0 ? `#/q/${qs[i - 1].id}` : ""}" ${i > 0 ? "" : "disabled"}>${T("上一题")}</button>
      <button data-go="${i >= 0 && qs[i + 1] ? `#/q/${qs[i + 1].id}` : ""}" ${i >= 0 && qs[i + 1] ? "" : "disabled"}>${T("下一题")}</button></div></main>`;
  count(q, store.drafts[id] ?? "");
  scrollTo(0, 0);
}

// ---------- 模考 ----------
function mock() {
  if (!store.running) {
    const used = new Set(store.mocks.flatMap((m) => m.ids));
    const pick = (t) => {
      const all = ALL.filter((q) => q.task === t && q.keep === q.id), fresh = all.filter((q) => !used.has(q.id));
      const from = fresh.length ? fresh : all;
      return from[Math.floor(Math.random() * from.length)].id;
    };
    store.running = { ids: [1, 2, 3].map(pick), text: {}, deadline: Date.now() + MOCK_MIN * 60000 };
    save();
  }
  const r = store.running;
  app.innerHTML = header(T("写作模考"), `<span class="timer"></span><a href="#/">${T("先退出")}</a>`) + `<main>
    ${r.ids.map((id) => `<div class="card mockq"><div class="row">${tag(BY[id].task)}</div>${promptHtml(BY[id])}${editor(BY[id], r.text[id] ?? "")}</div>`).join("")}
    <div class="row"><button class="primary" data-act="submit">${T("交卷，看范文")}</button><button data-act="drop">${T("放弃这次模考")}</button></div></main>`;
  r.ids.forEach((id) => count(BY[id], r.text[id] ?? ""));
  const tick = () => {
    const left = Math.max(0, r.deadline - Date.now()), el = $(".timer");
    if (el) {
      el.textContent = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, "0")}`;
      el.classList.toggle("low", left < 300000);
    }
    if (!left) submit(true);
  };
  ticker = setInterval(tick, 1000); tick();
  scrollTo(0, 0);
}
function submit(auto) {
  const r = store.running;
  const empty = r.ids.filter((id) => !(r.text[id] ?? "").trim()).length;
  if (!auto && empty && !confirm(`${T("还有")} ${empty} ${T("题没写，确定交卷吗？")}`)) return;
  store.mocks.push({ at: Date.now(), ids: r.ids, text: r.text });
  store.running = null; save();
  location.hash = `#/mock/${store.mocks.length - 1}`;
}
function mockView(k) {
  const m = store.mocks[k];
  if (!m) return void (location.hash = "#/mocks");
  app.innerHTML = header("" + T("模考") + " " + new Date(m.at).toLocaleString(T.locale(), { dateStyle: "short", timeStyle: "short" }), `<a href="#/mocks">${T("← 记录")}</a>`) + `<main>
    ${m.ids.map((id) => BY[id]).filter(Boolean).map((q) => `<div class="card mockq"><div class="row">${tag(q.task)}<span class="muted">${esc(q.no)}</span>${T.lang() === "zh" ? `<strong>${esc(q.title)}</strong>` : ""}</div>
      ${promptHtml(q)}<div class="sec"><h3>${T("我的作文")} <span class="muted">${words(m.text[q.id] ?? "")} ${T("词")}</span></h3><p lang="fr">${esc(m.text[q.id] || T("（没写）"))}</p></div>${modelHtml(q)}</div>`).join("")}</main>`;
  scrollTo(0, 0);
}
function mocks() {
  app.innerHTML = header(T("模考记录"), `<a href="#/">${T("← 列表")}</a>`) + `<main><table><tr><th>${T("时间")}</th><th>${T("题目")}</th><th>${T("词数")}</th><th></th></tr>
    ${store.mocks.map((m, k) => `<tr><td>${new Date(m.at).toLocaleString(T.locale(), { dateStyle: "short", timeStyle: "short" })}</td><td>${m.ids.map((i) => esc(BY[i] ? ttl(BY[i]) : "")).join(T("；"))}</td><td>${m.ids.map((i) => words(m.text[i] ?? "")).join(" / ")}</td><td><a href="#/mock/${k}">${T("查看")}</a></td></tr>`).reverse().join("")}</table></main>`;
}

// ---------- 事件 ----------
function route() {
  clearInterval(ticker); lastField = null;
  const [, a, b] = location.hash.split("/");
  if (a === "q") question(b);
  else if (a === "mock" && b) mockView(+b);
  else if (a === "mock") mock();
  else if (a === "mocks") mocks();
  else home();
}
const current = () => location.hash.split("/")[2];
const toggle = (o, id) => { if (o[id]) delete o[id]; else o[id] = 1; save(); };
const acts = {
  theme() { localStorage.setItem("tcf.theme", document.documentElement.dataset.theme === "dark" ? "light" : "dark"); applyTheme(); },
  model(b) {
    const m = $("#model"); m.hidden = !m.hidden;
    if (!m.innerHTML) m.innerHTML = modelHtml(BY[current()]);
    b.textContent = m.hidden ? T("看范文") : T("收起范文");
  },
  done(b) { toggle(store.done, current()); b.textContent = store.done[current()] ? T("取消写完") : T("标记写完"); },
  star(b) { toggle(store.star, current()); b.textContent = store.star[current()] ? T("★ 已收藏") : T("☆ 收藏"); },
  async copy(b) {
    try { await navigator.clipboard.writeText($("textarea").value); b.textContent = T("已复制"); }
    catch { $("textarea").select(); b.textContent = document.execCommand("copy") ? T("已复制") : T("复制失败"); }
    setTimeout(() => { b.textContent = T("复制我的作文"); }, 1500);
  },
  submit: () => submit(false),
  drop() { if (confirm(T("放弃后这次写的内容会删除，确定吗？"))) { store.running = null; save(); location.hash = "#/"; } },
};
app.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.go) location.hash = b.dataset.go;
  else if (b.dataset.act) acts[b.dataset.act](b);
  else if (b.dataset.task) { store.filter.task = +b.dataset.task; save(); home(); }
  else if (b.dataset.char) {
    const box = b.parentElement.nextElementSibling, t = lastField?.isConnected && lastField === box ? lastField : box;
    t.focus(); t.setRangeText(b.dataset.char, t.selectionStart, t.selectionEnd, "end");
    t.dispatchEvent(new Event("input", { bubbles: true }));
  }
});
app.addEventListener("focusin", (e) => { if (e.target.matches("textarea")) lastField = e.target; });
app.addEventListener("input", (e) => {
  const t = e.target;
  if (t.matches("textarea")) {
    const id = t.dataset.q, into = location.hash.startsWith("#/mock") ? store.running?.text : store.drafts;
    if (!into) return;
    if (t.value.trim()) into[id] = t.value; else delete into[id];
    save(); count(BY[id], t.value);
  } else if (t.id === "text") { store.filter.text = t.value; save(); list(); }
});
app.addEventListener("change", (e) => {
  const t = e.target, f = store.filter;
  if (t.id === "cat") f.cat = t.value; else if (t.id === "state") f.state = t.value; else if (t.id === "uniq") f.uniq = t.checked; else return;
  save(); list();
});
addEventListener("hashchange", route);
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
applyTheme(); route();
