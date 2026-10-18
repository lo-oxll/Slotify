import {
  auth, db, signInAnonymously, collection, doc, getDoc, getDocs, query, where, runTransaction, serverTimestamp,
} from "./firebase.js";
import {
  $, esc, renderHeader, session, PHONE_RE, cleanPhone, candidateTimes, freeStaff, staffOf, blocksOf,
  busyDocId, today, nowTime,
} from "./common.js";

const sess = await session();
renderHeader(sess);
const { user, profile } = sess;
const app = $("#app");
const id = new URLSearchParams(location.search).get("id");
const snap = id ? await getDoc(doc(db, "services", id)) : null;

if (!snap?.exists()) {
  app.innerHTML = `<p>الخدمة غير موجودة. <a class="teal" href="services.html">العودة للخدمات</a></p>`;
} else {
  await init({ id, ...snap.data() });
}

async function init(svc) {
  const biz = (await getDoc(doc(db, "businesses", svc.businessId))).data();
  const staffList = staffOf(biz);
  app.innerHTML = `
    <div class="card">
      <h1 style="margin:0">${esc(svc.name)}</h1>
      <p class="small muted">${esc(biz.name)} · ${esc(biz.city)} · <span dir="ltr">${esc(biz.phone)}</span></p>
      ${svc.desc ? `<p class="small mt">${esc(svc.desc)}</p>` : ""}
      <p class="price">${esc(svc.price)} · ${esc(svc.duration)} دقيقة</p>
    </div>
    <div class="card stack mt" id="box"></div>`;

  if (profile?.role === "business") {
    $("#box").innerHTML = `<p class="small">أنت مسجّل كنشاط تجاري. للحجز استخدم حساب عميل.</p>`;
    return;
  }

  $("#box").innerHTML = `
    <div class="grid g2">
      <div><label class="label" for="date">اليوم</label><input type="date" class="input" id="date" min="${today()}" value="${today()}"></div>
      ${staffList.length > 1 ? `<div><label class="label" for="staff">الموظف</label><select class="input" id="staff"><option value="any">أي موظف</option>${staffList.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("")}</select></div>` : ""}
    </div>
    <div><p class="label">الأوقات المتاحة</p><div id="times" class="row"></div></div>
    <div id="form" class="stack" hidden style="border-top:1px solid var(--line);padding-top:1rem">
      <div><label class="label">الاسم</label><input class="input" id="name" value="${esc(profile?.name || "")}"></div>
      <div><label class="label">رقم الهاتف (مطلوب)</label><input class="input" dir="ltr" type="tel" id="phone" placeholder="+966500000000" value="${esc(profile?.phone || "")}"></div>
      <div><label class="label">البريد الإلكتروني (اختياري)</label><input class="input" dir="ltr" type="email" id="email"></div>
      ${user ? "" : `<label class="checkrow"><input type="checkbox" id="terms"><span>أوافق على <a class="teal" href="terms.html">الشروط</a> و<a class="teal" href="privacy.html">سياسة الخصوصية</a></span></label>`}
    </div>
    <p class="err" id="err" role="alert"></p>
    <button class="btn block" id="go" disabled>تأكيد الحجز</button>`;

  let date = today(), time = "", staff = "any", busy = new Set();

  async function loadBusy() {
    const s = await getDocs(query(collection(db, "busy"), where("businessId", "==", svc.businessId), where("date", "==", date)));
    busy = new Set(s.docs.map((d) => `${d.data().staffId}_${d.data().time}`));
  }
  function renderTimes() {
    const times = candidateTimes(biz, svc.duration, date)
      .filter((t) => date > today() || t > nowTime())
      .filter((t) => freeStaff(busy, biz, t, svc.duration).some((s) => staff === "any" || s.id === staff));
    $("#times").innerHTML = times.length
      ? times.map((t) => `<button type="button" class="chip" dir="ltr" data-t="${t}" aria-pressed="${t === time}">${t}</button>`).join("")
      : `<p class="muted small">لا توجد أوقات متاحة في هذا اليوم. جرّب يومًا آخر.</p>`;
    $("#form").hidden = !time;
    $("#go").disabled = !time;
  }
  const refresh = async () => { time = ""; await loadBusy(); renderTimes(); };

  $("#times").addEventListener("click", (e) => {
    const b = e.target.closest("[data-t]");
    if (b) { time = b.dataset.t; renderTimes(); }
  });
  $("#date").addEventListener("change", (e) => { date = e.target.value || today(); refresh(); });
  $("#staff")?.addEventListener("change", (e) => { staff = e.target.value; time = ""; renderTimes(); });

  $("#go").addEventListener("click", async () => {
    const err = (m) => { $("#err").textContent = m; };
    err("");
    const name = $("#name").value.trim(), phone = cleanPhone($("#phone").value), email = $("#email").value.trim();
    if (name.length < 2) return err("أدخل اسمك");
    if (!PHONE_RE.test(phone)) return err("رقم الهاتف مطلوب لإتمام الحجز، أدخله مع رمز الدولة مثل +966500000000");
    if (!user && !$("#terms").checked) return err("يجب الموافقة على الشروط وسياسة الخصوصية");
    $("#go").disabled = true; $("#go").textContent = "جارٍ الحجز…";
    try {
      const u = auth.currentUser || (await signInAnonymously(auth)).user;
      const wanted = staff === "any" ? staffList : staffList.filter((s) => s.id === staff);
      const blocks = blocksOf(time, svc.duration);
      const bookingRef = doc(collection(db, "bookings"));
      await runTransaction(db, async (tx) => {
        const refs = wanted.flatMap((s) => blocks.map((b) => doc(db, "busy", busyDocId(svc.businessId, s.id, date, b))));
        const snaps = await Promise.all(refs.map((r) => tx.get(r)));
        const free = wanted.find((s, i) => snaps.slice(i * blocks.length, (i + 1) * blocks.length).every((x) => !x.exists()));
        if (!free) throw new Error("taken");
        blocks.forEach((b) => tx.set(doc(db, "busy", busyDocId(svc.businessId, free.id, date, b)),
          { businessId: svc.businessId, staffId: free.id, date, time: b, bookingId: bookingRef.id }));
        tx.set(bookingRef, {
          serviceId: svc.id, serviceName: svc.name, businessId: svc.businessId, businessName: biz.name,
          clientId: u.uid, clientName: name, date, time, duration: svc.duration,
          staffId: free.id, staffName: free.name, status: biz.autoConfirm === true ? "confirmed" : "pending",
          createdAt: serverTimestamp(),
        });
        tx.set(doc(db, "bookings", bookingRef.id, "contact", "info"), { name, phone, email: email || null });
        if (!profile) tx.set(doc(db, "users", u.uid), { role: "client", name, phone });
      });
      location.href = "bookings.html";
    } catch (e) {
      err(e.message === "taken" ? "هذا الوقت حُجز للتو، اختر وقتًا آخر" : "تعذّر إتمام الحجز، تحقق من البيانات وحاول مرة أخرى");
      $("#go").textContent = "تأكيد الحجز";
      await refresh();
    }
  });

  await refresh();
}
