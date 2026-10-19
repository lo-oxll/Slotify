import { db, collection, doc, getDoc, getDocs, deleteDoc, query, where, limit } from "./firebase.js";
import { $, esc, session, renderHeader, rankJobsFor, RECOMMEND, APP_STATUS, JOB_TYPES, applyToJob } from "./common.js";

const sess = await session();
renderHeader(sess);
const { user, profile } = sess;
const app = $("#app");

let cv = null;
if (profile?.role === "client") {
  const s = await getDoc(doc(db, "cvs", user.uid));
  cv = s.exists() ? s.data() : null;
}
const [js, as] = await Promise.all([
  getDocs(query(collection(db, "jobs"), where("active", "==", true), limit(300))),
  cv ? getDocs(query(collection(db, "applications"), where("candidateId", "==", user.uid))) : null,
]);
const all = js.docs.map((d) => ({ id: d.id, ...d.data() }));
const personal = !!cv;
const ranked = personal
  ? rankJobsFor(cv, all)
  : all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map((job) => ({ job, score: null, matched: [], missing: [] }));
const applied = new Map((as?.docs || []).map((d) => [d.data().jobId, d.data()]));
let tab = personal ? "match" : "all", q = "", type = "";

const jobUrl = (id) => `job.html?id=${encodeURIComponent(id)}`;
const scoreCls = (n) => (n >= 70 ? "s-high" : n >= 45 ? "s-mid" : "s-low");

const banner = !user
  ? `<div class="card hl mb"><p class="title">سجّل لتصلك الوظائف المناسبة تلقائيًا</p>
      <p class="small muted">أنشئ سيرتك الذاتية مرة واحدة، ونرتّب لك الوظائف بحسب مهاراتك ونسبة التوافق.</p>
      <a class="btn mt" href="login.html?role=client&next=jobs.html">دخول / تسجيل الأفراد</a></div>`
  : profile?.role === "client" && !cv
    ? `<div class="card hl mb"><p class="title">أنشئ سيرتك الذاتية أولًا</p>
        <p class="small muted">نرشّح لك الوظائف المناسبة تلقائيًا بحسب سيرتك.</p>
        <a class="btn mt" href="cv.html?next=jobs.html">إنشاء السيرة</a></div>`
    : profile?.role === "business" ? `<p class="small muted mb">أنت مسجّل كشركة، فالتقديم متاح لحسابات الأفراد فقط.</p>` : "";

app.innerHTML = `${banner}
  <div class="tabs" id="tabs" role="tablist" ${personal ? "" : "hidden"}></div>
  <div class="grid g2 mb"><input class="input" id="q" placeholder="ابحث في الوظائف والمهارات">
    <select class="input" id="type"><option value="">كل أنواع الدوام</option>${JOB_TYPES.map((t) => `<option>${esc(t)}</option>`).join("")}</select></div>
  <p id="state" class="muted"></p><div id="list" class="stack"></div>`;

function action(j) {
  if (!user) return `<a class="btn" href="login.html?role=client&next=${encodeURIComponent(jobUrl(j.id))}">سجّل للتقديم</a>`;
  if (profile?.role !== "client") return "";
  if (!cv) return `<a class="btn" href="cv.html?next=${encodeURIComponent(jobUrl(j.id))}">أنشئ سيرتك للتقديم</a>`;
  const a = applied.get(j.id);
  return a ? `<span class="small teal">تم التقديم · ${APP_STATUS[a.status] || ""}</span>` : `<button class="btn" data-apply="${esc(j.id)}">تقدّم للوظيفة</button>`;
}

function card(r) {
  const j = r.job;
  return `<div class="card stack">
    <div class="row between">
      <div><a class="title teal" href="${jobUrl(j.id)}">${esc(j.title)}</a>
        <p class="small muted">${esc(j.businessName)} · ${esc(j.city)} · ${esc(j.type)}${j.salary ? ` · ${esc(j.salary)}` : ""}</p></div>
      ${personal ? `<span class="score ${scoreCls(r.score)}" title="نسبة التوافق مع سيرتك">${r.score}%</span>` : ""}
    </div>
    <div class="row">${personal
      ? r.matched.map((s) => `<span class="tag ok">✓ ${esc(s)}</span>`).join("") + r.missing.map((s) => `<span class="tag miss">${esc(s)}</span>`).join("")
      : (j.skills || []).map((s) => `<span class="tag" style="cursor:default">${esc(s)}</span>`).join("")}</div>
    <p class="small muted">${j.minYears ? `خبرة ${esc(j.minYears)}+ سنوات · ` : ""}المؤهل: ${esc(j.education)}</p>
    ${j.description ? `<p class="small">${esc(j.description.slice(0, 200))}${j.description.length > 200 ? "…" : ""}</p>` : ""}
    <div>${action(j)}</div>
  </div>`;
}

function render() {
  const mine = [...applied.values()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (personal)
    $("#tabs").innerHTML = [["match", `مناسبة لي (${ranked.filter((r) => r.score >= RECOMMEND).length})`], ["all", "كل الوظائف"], ["mine", `طلباتي (${mine.length})`]]
      .map(([k, v]) => `<button class="tab" role="tab" aria-selected="${tab === k}" data-tab="${k}">${v}</button>`).join("");
  $("#q").parentElement.hidden = tab === "mine";
  let html = "", empty = "";
  if (tab === "mine") {
    html = mine.map((a) => `<div class="card row between"><div><a class="title teal" href="${jobUrl(a.jobId)}">${esc(a.jobTitle)}</a><p class="small muted">${esc(a.businessName)}</p></div>
      <div class="row"><span class="score ${scoreCls(a.score)}">${esc(a.score)}%</span><span class="small teal">${APP_STATUS[a.status] || ""}</span>
      <button class="btn-danger" data-withdraw="${esc(a.jobId)}">سحب الطلب</button></div></div>`).join("");
    empty = "لم تتقدّم لأي وظيفة بعد.";
  } else {
    const rows = ranked.filter((r) => (tab === "all" || r.score >= RECOMMEND) && (!type || r.job.type === type) &&
      (!q || `${r.job.title} ${r.job.businessName} ${r.job.description || ""} ${(r.job.skills || []).join(" ")}`.includes(q)));
    html = rows.map(card).join("");
    empty = tab === "match" ? "لا توجد وظائف مطابقة حاليًا. أضف مهارات أكثر إلى سيرتك أو شاهد «كل الوظائف»." : "لا توجد وظائف منشورة بعد.";
  }
  $("#list").innerHTML = html;
  $("#state").textContent = html ? "" : empty;
}

$("#tabs").addEventListener("click", (e) => { const t = e.target.closest("[data-tab]"); if (t) { tab = t.dataset.tab; render(); } });
$("#q").addEventListener("input", (e) => { q = e.target.value.trim(); render(); });
$("#type").addEventListener("change", (e) => { type = e.target.value; render(); });
$("#list").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-apply]"), w = e.target.closest("[data-withdraw]");
  try {
    if (b) {
      b.disabled = true;
      const r = ranked.find((x) => x.job.id === b.dataset.apply);
      applied.set(r.job.id, await applyToJob(r.job, cv, sess, r.score));
      render();
    } else if (w && confirm("سحب طلب التقديم؟")) {
      await deleteDoc(doc(db, "applications", `${w.dataset.withdraw}_${user.uid}`));
      applied.delete(w.dataset.withdraw);
      render();
    }
  } catch { alert("تعذّر تنفيذ الإجراء، حاول مرة أخرى"); b && (b.disabled = false); }
});
render();
