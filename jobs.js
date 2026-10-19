import { db, collection, doc, getDoc, getDocs, setDoc, query, where, limit, serverTimestamp } from "./firebase.js";
import { $, esc, guard, rankJobsFor, RECOMMEND, APP_STATUS } from "./common.js";

const S = await guard("client");
if (S) await main();

async function main() {
  const uid = S.user.uid, app = $("#app");
  const cvSnap = await getDoc(doc(db, "cvs", uid));
  if (!cvSnap.exists()) {
    app.innerHTML = `<div class="card hl"><p class="title">أنشئ سيرتك الذاتية أولًا</p>
      <p class="small muted">نرشّح لك الوظائف المناسبة تلقائيًا بحسب مهاراتك وخبرتك.</p>
      <a class="btn mt" href="cv.html">إنشاء السيرة</a></div>`;
    return;
  }
  const cv = cvSnap.data();
  const [js, as] = await Promise.all([
    getDocs(query(collection(db, "jobs"), where("active", "==", true), limit(300))),
    getDocs(query(collection(db, "applications"), where("candidateId", "==", uid))),
  ]);
  const ranked = rankJobsFor(cv, js.docs.map((d) => ({ id: d.id, ...d.data() })));
  const applied = new Map(as.docs.map((d) => [d.data().jobId, d.data()]));
  let tab = "match", q = "";

  app.innerHTML = `
    <div class="tabs" id="tabs" role="tablist"></div>
    <input class="input mb" id="q" placeholder="ابحث في الوظائف">
    <p id="state" class="muted"></p>
    <div id="list" class="stack"></div>`;

  const scoreCls = (n) => (n >= 70 ? "s-high" : n >= 45 ? "s-mid" : "s-low");

  function jobCard(r) {
    const j = r.job, a = applied.get(j.id);
    return `<div class="card stack">
      <div class="row between">
        <div><p class="title">${esc(j.title)}</p><p class="small muted">${esc(j.businessName)} · ${esc(j.city)} · ${esc(j.type)}${j.salary ? ` · ${esc(j.salary)}` : ""}</p></div>
        <span class="score ${scoreCls(r.score)}" title="نسبة التوافق مع سيرتك">${r.score}%</span>
      </div>
      <div class="row">
        ${r.matched.map((s) => `<span class="tag ok">✓ ${esc(s)}</span>`).join("")}
        ${r.missing.map((s) => `<span class="tag miss">${esc(s)}</span>`).join("")}
      </div>
      <p class="small muted">${j.minYears ? `خبرة ${esc(j.minYears)}+ سنوات · ` : ""}المؤهل: ${esc(j.education)}</p>
      ${j.description ? `<p class="small">${esc(j.description.slice(0, 220))}${j.description.length > 220 ? "…" : ""}</p>` : ""}
      <div>${a ? `<span class="small teal">تم التقديم · ${APP_STATUS[a.status] || ""}</span>` : `<button class="btn" data-apply="${esc(j.id)}">تقدّم للوظيفة</button>`}</div>
    </div>`;
  }

  function render() {
    const mine = [...applied.values()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    $("#tabs").innerHTML = [["match", `مناسبة لي (${ranked.filter((r) => r.score >= RECOMMEND).length})`], ["all", "كل الوظائف"], ["mine", `طلباتي (${mine.length})`]]
      .map(([k, v]) => `<button class="tab" role="tab" aria-selected="${tab === k}" data-tab="${k}">${v}</button>`).join("");
    $("#q").hidden = tab === "mine";
    let html = "", empty = "";
    if (tab === "mine") {
      html = mine.map((a) => `<div class="card row between"><div><p class="title">${esc(a.jobTitle)}</p><p class="small muted">${esc(a.businessName)}</p></div><div class="row"><span class="score ${scoreCls(a.score)}">${esc(a.score)}%</span><span class="small teal">${APP_STATUS[a.status] || ""}</span></div></div>`).join("");
      empty = "لم تتقدّم لأي وظيفة بعد.";
    } else {
      const rows = ranked.filter((r) => (tab === "all" || r.score >= RECOMMEND) &&
        (!q || `${r.job.title} ${r.job.businessName} ${r.job.description || ""} ${(r.job.skills || []).join(" ")}`.includes(q)));
      html = rows.map(jobCard).join("");
      empty = tab === "match" ? "لا توجد وظائف مطابقة حاليًا. أضف مهارات أكثر إلى سيرتك أو شاهد «كل الوظائف»." : "لا توجد وظائف منشورة بعد.";
    }
    $("#list").innerHTML = html;
    $("#state").textContent = html ? "" : empty;
  }

  $("#tabs").addEventListener("click", (e) => { const t = e.target.closest("[data-tab]"); if (t) { tab = t.dataset.tab; render(); } });
  $("#q").addEventListener("input", (e) => { q = e.target.value.trim(); render(); });
  $("#list").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-apply]");
    if (!b) return;
    const r = ranked.find((x) => x.job.id === b.dataset.apply), j = r.job;
    b.disabled = true;
    const data = {
      jobId: j.id, jobTitle: j.title, businessId: j.businessId, businessName: j.businessName,
      candidateId: uid, name: cv.name, phone: S.profile.phone, email: S.user.email || cv.contact || "",
      cvTitle: cv.title, score: r.score, status: "new", createdAt: serverTimestamp(),
    };
    try { await setDoc(doc(db, "applications", `${j.id}_${uid}`), data); applied.set(j.id, data); render(); }
    catch { alert("تعذّر إرسال الطلب، حاول مرة أخرى"); b.disabled = false; }
  });
  render();
}
