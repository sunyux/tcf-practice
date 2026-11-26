"use strict";
// 首页：只读各页面存在浏览器里的进度，不修改
const app = document.getElementById("app");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || "{}") ?? {}; } catch { return {}; } };
const n = (o) => Object.keys(o ?? {}).length;
const sum = (a) => a.reduce((x, y) => x + y, 0);

function applyTheme() {
  const t = localStorage.getItem("tcf.theme");
  document.documentElement.dataset.theme = (t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
}
const pct = (a, b) => (b ? Math.min(100, (a / b) * 100) : 0);
const bar = (label, a, b, href, cls = "") => `<a class="prow" href="${href}"><span class="tag ${cls}">${esc(label)}</span><span class="bar"><i style="width:${pct(a, b)}%"></i></span><span class="muted num">${a}/${b}</span></a>`;
const fact = (v, l) => `<span class="muted"><b>${v}</b> ${l}</span>`;
const panel = (href, name, total, facts, rows, buttons) => `<section class="skill">
  <h2><a href="${href}">${name}</a> <span class="muted">${total}</span></h2>
  <div class="row facts">${facts.filter(Boolean).join("")}</div><div class="rows">${rows}</div>
  <div class="row">${buttons.filter(Boolean).map(([h, l, p]) => `<a class="btn${p ? " primary" : ""}" href="${h}">${esc(l)}</a>`).join("")}</div></section>`;

// 听力、阅读：同一套题目结构
function tests(page, name, key, d, min) {
  const s = read(key), lv = Object.entries(d.levels);
  const done = (l) => Object.keys(s.level?.[l]?.answers ?? {}).filter((u) => !d.alias[u]).length;
  const best = Math.max(0, ...Object.values(s.exams ?? {}).flat().map((e) => e.score));
  const answered = sum(Object.values(s.practice ?? {}).map((p) => n(p.answers)));
  const go = Object.entries(s.running ?? {}).find(([, r]) => r.deadline > Date.now())?.[0];
  const next = lv.find(([l, c]) => done(l) < c)?.[0];
  return panel(page, name, `${sum(lv.map(([, c]) => c))} 题不重复，${d.tests.length} 套，模考 ${min} 分钟`,
    [fact(best || "–", "模考最高分"), fact(answered, "整套练习已答"), fact(n(s.wrong), "错题"), fact(n(s.star), "收藏")],
    lv.map(([l, c]) => bar(l, done(l), c, `${page}#/level/${l}`, `lv-${l}`)).join(""),
    [go ? [`${page}#/exam/${go}`, `继续模考 ${go.replace("test", "Test ")}`, 1] : next && [`${page}#/level/${next}`, `练 ${next}`, 1],
      n(s.wrong) && [`${page}#/wrong`, "练错题"], [page, "全部"], ["memo.html#/", "背题"]]);
}
function writing() {
  const m = window.TCF_META_WRITING, s = read("tcf.writing.v1");
  return panel("writing.html", "写作", `${m.uniq} 题不重复，${Object.entries(m.tasks).map(([t, c]) => `Tâche ${t}：${c}`).join("，")}`,
    [fact(n(s.mocks), "次模考"), fact(n(s.drafts), "篇草稿"), fact(n(s.star), "收藏")],
    bar("写完", n(s.done), m.uniq, "writing.html"),
    [["writing.html#/mock", s.running ? "继续模考" : "模考 60 分钟", 1], ["writing.html", "全部"]]);
}
function speaking() {
  const m = window.TCF_META_SPEAKING, s = read("tcf.speaking.v1");
  return panel("speaking.html", "口语", `${m.uniq} 题不重复，${Object.entries(m.tasks).map(([t, c]) => `Tâche ${t}：${c}`).join("，")}，快速套 ${m.quick}`,
    [fact(n(s.star), "收藏")], bar("练过", n(s.done), m.uniq, "speaking.html"), [["speaking.html", "开始练", 1]]);
}
function vocab() {
  const m = window.TCF_META_VOCAB, s = read("tcf.vocab.v1");
  const ok = Object.values(s.mem ?? {}).filter((x) => x.b > 0).length, due = Object.values(s.mem ?? {}).filter((x) => x.d <= Date.now()).length;
  return panel("vocab.html", "词汇库", `听说读写真题里的词，可多选筛选；短语 ${m.phrases}`,
    [fact(ok, "认识"), fact(due, "该复习")], "", [["vocab.html#/w", "单词", 1], ["vocab.html#/ph", "短语"]]);
}
function home() {
  if (!window.TCF_L || !window.TCF_R || !window.TCF_META_WRITING || !window.TCF_META_SPEAKING || !window.TCF_META_VOCAB) return;   // 手机版还没导入题库
  app.innerHTML = `<header><h1>TCF Canada 练习</h1><button id="theme" aria-label="切换深浅色">◐</button></header><main class="hub">
    ${tests("listening.html", "听力", "tcf.listening.v1", window.TCF_L, 35)}
    ${tests("reading.html", "阅读", "tcf.reading.v1", window.TCF_R, 60)}
    ${writing()}${speaking()}${vocab()}</main>`;
}
app.addEventListener("click", (e) => {
  if (e.target.id !== "theme") return;
  localStorage.setItem("tcf.theme", document.documentElement.dataset.theme === "dark" ? "light" : "dark"); applyTheme();
});
// 从练习页返回时刷新进度
addEventListener("pageshow", (e) => { if (e.persisted) { applyTheme(); home(); } });
addEventListener("storage", () => { applyTheme(); home(); });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
applyTheme(); home();
