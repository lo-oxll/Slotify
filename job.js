import { db, collection, doc, getDoc, getDocs, query, where } from "./firebase.js";
import { $, esc, session, renderHeader, score, applyToJob, APP_STATUS } from "./common.js";

const sess = await session();
renderHeader(sess);
const { user, profile } = sess;
const app = $("#app");
const id = new URLSearchParams(location.search).get("id");
const snap = id ? await getDoc(doc(db, "jobs", id)) : null;

if (!snap?.exists()) app.innerHTML = `<p>الوظيفة غير موجودة. <a class="teal" href="jobs.html">كل الوظائف</a></p>`;
else await init({ id, ...snap.data() });

async function init(job) {
  const biz = (await getDoc(doc(db, "businesses", job.businessId))).data() || {};
  let cv = null, applied = null;
  if (profile?.role === "client") {
    const s = await getDoc(doc(db, "cvs", user.uid));
    cv = s.exists() ? s.data() : null;
    if (cv) {
      const a = await getDocs(query(collection(db, "applications"), where("candidateId", "==", user.uid)));
      applied = a.docs.map((d) => d.data()).find((x) => x.jobId === job.id) || null;
    }
  }
  const r = cv ? score(job, cv) : null;
  const here = encodeURIComponent(`job.html?id=${job.id}`);
  document.title = `${job.title} — وقتي`;

  function action() {
    if (!job.active) return `<p class="small muted">هذه الوظيفة غير متاحة حاليًا.</p>`;
    if (!user) return `<a class="btn" href="login.html?role=client&next=${here}">سجّل للتقديم</a>`;
    if (profile?.role === "business") return `<p class="small muted">التقديم متاح لحسابات الأفراد فقط.</p>`;
    if (!cv) return `<a class="btn" href="cv.html?next=${here}">أنشئ سيرتك للتقديم</a>`;
    return applied ? `<p class="teal">تم التقديم · ${APP_STATUS[applied.status] || ""}</p>` : `<button class="btn" id="apply">تقدّم للوظيفة</button>`;
  }

  app.innerHTML = `
    <div class="card stack">
      <div class="row between">
        <div><h1 style="margin:0">${esc(job.title)}</h1>
          <p class="small muted">${biz.slug ? `<a class="teal" href="b.html?s=${encodeURIComponent(biz.slug)}">${esc(job.businessName)}</a>` : esc(job.businessName)} · ${esc(job.city)} · ${esc(job.type)}</p></div>
        ${r ? `<span class="score ${r.score >= 70 ? "s-high" : r.score >= 45 ? "s-mid" : "s-low"}" title="نسبة التوافق مع سيرتك">${r.score}%</span>` : ""}
      </div>
      <p class="small">${job.salary ? `الراتب: ${esc(job.salary)} · ` : ""}${job.minYears ? `خبرة ${esc(job.minYears)}+ سنوات · ` : ""}المؤهل: ${esc(job.education)}</p>
      <div><p class="label">المهارات المطلوبة</p><div class="row">${r
        ? r.matched.map((s) => `<span class="tag ok">✓ ${esc(s)}</span>`).join("") + r.missing.map((s) => `<span class="tag miss">${esc(s)}</span>`).join("")
        : (job.skills || []).map((s) => `<span class="tag" style="cursor:default">${esc(s)}</span>`).join("")}</div></div>
      ${job.description ? `<div><p class="label">الوصف</p><p style="white-space:pre-line">${esc(job.description)}</p></div>` : ""}
      <div class="row">${action()}<button class="btn-alt" id="copy">نسخ رابط الوظيفة</button></div>
      <p class="err" id="err" role="alert"></p>
    </div>`;

  $("#copy").onclick = () => navigator.clipboard.writeText(location.href);
  $("#apply")?.addEventListener("click", async (e) => {
    e.target.disabled = true;
    try { await applyToJob(job, cv, sess, r.score); location.reload(); }
    catch { $("#err").textContent = "تعذّر إرسال الطلب، حاول مرة أخرى"; e.target.disabled = false; }
  });
}
