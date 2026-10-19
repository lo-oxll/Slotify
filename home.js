import { db, collection, doc, getDoc, getDocs, setDoc, query, where, limit } from "./firebase.js";
import { $, esc, guard, today, PHONE_RE, cleanPhone, rankJobsFor, RECOMMEND, cvCompleteness, STATUS, APP_STATUS } from "./common.js";

const S = await guard("client");
if (S) await main();

async function main() {
  const uid = S.user.uid, app = $("#app");
  const [cvS, bk, js, as] = await Promise.all([
    getDoc(doc(db, "cvs", uid)),
    getDocs(query(collection(db, "bookings"), where("clientId", "==", uid))),
    getDocs(query(collection(db, "jobs"), where("active", "==", true), limit(300))),
    getDocs(query(collection(db, "applications"), where("candidateId", "==", uid))),
  ]);
  const cv = cvS.exists() ? cvS.data() : null;
  const t = today();
  const upcoming = bk.docs.map((d) => ({ id: d.id, ...d.data() }))
    .filter((b) => ["pending", "confirmed"].includes(b.status) && b.date >= t)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const apps = as.docs.map((d) => d.data());
  const picks = cv ? rankJobsFor(cv, js.docs.map((d) => ({ id: d.id, ...d.data() }))).filter((r) => r.score >= RECOMMEND).slice(0, 3) : [];
  const pct = cv ? cvCompleteness(cv) : 0;
  const cnt = (s) => apps.filter((a) => a.status === s).length;

  app.innerHTML = `
    <h1>مرحبًا ${esc(S.profile.name)}</h1>
    <div class="grid g2">
      <div class="card stack">
        <p class="title">مواعيدي القادمة</p>
        ${upcoming.length ? upcoming.slice(0, 3).map((b) => `<div class="row between"><div><p>${esc(b.serviceName)} — ${esc(b.businessName)}</p>
          <p class="small muted" dir="ltr" style="text-align:right">${esc(b.date)} ${esc(b.time)}</p></div><span class="small ${b.status === "confirmed" ? "teal" : "muted"}">${STATUS[b.status]}</span></div>`).join("")
          : `<p class="small muted">لا توجد مواعيد قادمة.</p>`}
        <div class="row"><a class="btn-alt" href="services.html">احجز خدمة</a><a class="btn-alt" href="bookings.html">كل حجوزاتي</a></div>
      </div>

      <div class="card stack">
        <p class="title">سيرتي الذاتية</p>
        ${cv ? `<div class="row between"><span class="small muted">${esc(cv.title)}</span><b class="teal">${pct}%</b></div>
                <div class="meter"><i style="width:${pct}%"></i></div>
                <p class="small muted">${cv.open ? "ظاهرة للشركات" : "مخفية عن الشركات"} · ${cv.skills.length} مهارة</p>`
             : `<p class="small muted">لم تنشئ سيرتك بعد. أنشئها ليرشّحك النظام للشركات وترشّح لك الوظائف.</p>`}
        <div><a class="btn" href="cv.html">${cv ? "تعديل السيرة" : "إنشاء السيرة"}</a></div>
      </div>

      <div class="card stack span">
        <div class="row between"><p class="title">وظائف مناسبة لك</p><a class="teal small" href="jobs.html">كل الوظائف</a></div>
        ${!cv ? `<p class="small muted">أنشئ سيرتك لتظهر هنا الوظائف المطابقة لمهاراتك.</p>`
          : picks.length ? picks.map((r) => `<div class="row between"><div><a class="teal" href="job.html?id=${encodeURIComponent(r.job.id)}">${esc(r.job.title)}</a>
              <p class="small muted">${esc(r.job.businessName)} · ${esc(r.job.city)}</p></div><span class="score ${r.score >= 70 ? "s-high" : "s-mid"}">${r.score}%</span></div>`).join("")
          : `<p class="small muted">لا توجد وظائف مطابقة حاليًا. أضف مهارات أكثر إلى سيرتك.</p>`}
      </div>

      <div class="card stack">
        <p class="title">طلبات التوظيف</p>
        <p class="small">${apps.length} طلب · قيد المراجعة ${cnt("new")} · ${APP_STATUS.shortlisted} ${cnt("shortlisted")} · ${APP_STATUS.rejected} ${cnt("rejected")}</p>
        <div><a class="btn-alt" href="jobs.html">متابعة طلباتي</a></div>
      </div>

      <div class="card stack">
        <p class="title">بياناتي</p>
        <div><label class="label" for="a-name">الاسم</label><input class="input" id="a-name" value="${esc(S.profile.name)}"></div>
        <div><label class="label" for="a-phone">رقم الهاتف</label><input class="input" dir="ltr" id="a-phone" value="${esc(S.profile.phone)}"></div>
        <p class="err" id="a-err" role="alert"></p>
        <div class="row"><button class="btn-alt" id="a-save">حفظ</button><span class="small teal" id="a-ok" role="status"></span></div>
      </div>
    </div>`;

  $("#a-save").addEventListener("click", async () => {
    const name = $("#a-name").value.trim(), phone = cleanPhone($("#a-phone").value);
    $("#a-ok").textContent = ""; $("#a-err").textContent = "";
    if (name.length < 2) return ($("#a-err").textContent = "أدخل الاسم");
    if (!PHONE_RE.test(phone)) return ($("#a-err").textContent = "رقم الهاتف غير صالح، أدخله مع رمز الدولة");
    try { await setDoc(doc(db, "users", uid), { role: "client", name, phone }); $("#a-ok").textContent = "تم الحفظ"; }
    catch { $("#a-err").textContent = "تعذّر الحفظ"; }
  });
}
