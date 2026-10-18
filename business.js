import {
  auth, db, collection, doc, getDoc, getDocs, addDoc, deleteDoc, onSnapshot, query, where,
  runTransaction, writeBatch, sendEmailVerification,
} from "./firebase.js";
import { $, esc, guard, CATEGORIES, STATUS, WEEKDAYS, gcalLink, setBookingStatus } from "./common.js";

const S = await guard("business");
if (S) await main();

async function main() {
  const uid = S.user.uid;
  const app = $("#app");
  let biz = (await getDoc(doc(db, "businesses", uid))).data();
  const keep = () => ({ name: biz.name, city: biz.city, category: biz.category });
  let orig = keep(), savedSlug = biz.slug || "";
  let tab = "bookings", list = [], services = [], contacts = {}, msg = "", svcMsg = "";

  app.innerHTML = `<div id="verify"></div><div id="notif"></div><div class="tabs" id="tabs" role="tablist"></div><div id="panel"></div>`;

  /* ---------- شريط التحقق والتنبيهات ---------- */
  function renderTop() {
    $("#verify").innerHTML = auth.currentUser.emailVerified ? "" : `
      <div class="card warn mb">
        <p class="title">فعّل بريدك الإلكتروني لتتمكن من نشر الخدمات</p>
        <div class="row mt">
          <button class="btn-alt" data-top="send">إرسال رابط التحقق</button>
          <button class="btn-alt" data-top="check">تحققت، حدّث الحالة</button>
          <span class="small teal" id="vmsg"></span>
        </div>
      </div>`;
    $("#notif").innerHTML = "Notification" in window && Notification.permission === "default"
      ? `<button class="btn-alt mb" data-top="notify">فعّل تنبيهات الحجوزات الجديدة</button>` : "";
  }
  app.addEventListener("click", async (e) => {
    const el = e.target.closest("[data-top]");
    if (!el) return;
    if (el.dataset.top === "send") { await sendEmailVerification(auth.currentUser); $("#vmsg").textContent = "أُرسل رابط التحقق إلى بريدك"; }
    if (el.dataset.top === "check") { await auth.currentUser.reload(); await auth.currentUser.getIdToken(true); renderTop(); renderPanel(); }
    if (el.dataset.top === "notify") { await Notification.requestPermission(); renderTop(); }
  });

  /* ---------- التبويبات ---------- */
  const pending = () => list.filter((b) => b.status === "pending").length;
  function renderTabs() {
    const tabs = { bookings: `الحجوزات${pending() ? ` (${pending()})` : ""}`, services: "الخدمات", profile: "الملف", stats: "الإحصائيات" };
    $("#tabs").innerHTML = Object.entries(tabs).map(([k, v]) =>
      `<button class="tab" role="tab" aria-selected="${tab === k}" data-tab="${k}">${v}</button>`).join("");
    document.title = pending() ? `(${pending()}) وقتي` : "وقتي";
  }
  $("#tabs").addEventListener("click", async (e) => {
    const t = e.target.closest("[data-tab]");
    if (!t) return;
    tab = t.dataset.tab; msg = ""; svcMsg = "";
    if (tab === "services") await loadServices();
    renderTabs(); renderPanel();
  });

  /* ---------- الحجوزات ---------- */
  function bookingsHTML() {
    if (!list.length) return `<p class="muted">لا توجد حجوزات واردة بعد. شارك رابط صفحتك مع عملائك من تبويب «الملف».</p>`;
    return `<div class="stack">${list.map((b) => {
      const c = contacts[b.id];
      return `<div class="card stack">
        <div class="row between">
          <div>
            <p class="title">${esc(b.serviceName)} — ${esc(b.clientName)}</p>
            <p class="small muted"><span dir="ltr">${esc(b.date)} ${esc(b.time)}</span> · ${esc(b.staffName)}</p>
            <p class="small teal">${STATUS[b.status]}</p>
          </div>
          <div class="row">
            ${b.status === "pending" ? `<button class="btn" data-act="confirm" data-id="${esc(b.id)}">قبول</button><button class="btn-danger" data-act="reject" data-id="${esc(b.id)}">رفض</button>` : ""}
            ${b.status === "confirmed" ? `${c ? "" : `<button class="btn-alt" data-act="reveal" data-id="${esc(b.id)}">عرض رقم العميل</button>`}<a class="btn-alt" href="${esc(gcalLink(b))}" target="_blank" rel="noopener">للتقويم</a><button class="btn-danger" data-act="cancel" data-id="${esc(b.id)}">إلغاء</button>` : ""}
          </div>
        </div>
        ${c ? `<div class="row small"><a class="teal" dir="ltr" href="tel:${esc(c.phone)}">${esc(c.phone)}</a><a class="teal" target="_blank" rel="noopener" href="https://wa.me/${esc(c.phone.replace(/^\+/, ""))}">واتساب</a></div>` : ""}
        ${b.status === "pending" ? `<p class="small muted">يظهر رقم العميل بعد قبول الحجز.</p>` : ""}
      </div>`;
    }).join("")}</div>`;
  }

  /* ---------- الخدمات ---------- */
  async function loadServices() {
    const s = await getDocs(query(collection(db, "services"), where("businessId", "==", uid)));
    services = s.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  function servicesHTML() {
    const ok = auth.currentUser.emailVerified;
    return `<div class="stack">
      <div class="card grid g3">
        <div><label class="label">اسم الخدمة</label><input class="input" id="s-name"></div>
        <div><label class="label">السعر</label><input class="input" type="number" min="0" id="s-price"></div>
        <div><label class="label">المدة (دقيقة، حتى 180)</label><input class="input" type="number" min="15" max="180" step="5" value="30" id="s-dur"></div>
        <div class="span"><label class="label">الوصف</label><input class="input" id="s-desc"></div>
        <p class="err span" role="alert">${esc(svcMsg)}</p>
        <div class="span"><button class="btn" data-act="add-service" ${ok ? "" : "disabled"}>إضافة الخدمة</button></div>
      </div>
      ${services.length ? "" : `<p class="muted">لم تضف أي خدمة بعد. أضف خدمتك الأولى ليراها العملاء.</p>`}
      ${services.map((s) => `<div class="card row between"><div><p class="title">${esc(s.name)}</p><p class="small muted">${esc(s.price)} · ${esc(s.duration)} دقيقة${s.desc ? ` · ${esc(s.desc)}` : ""}</p></div><button class="btn-danger" data-act="del-service" data-id="${esc(s.id)}">حذف</button></div>`).join("")}
    </div>`;
  }
  async function addService() {
    svcMsg = "";
    const name = $("#s-name").value.trim(), price = +$("#s-price").value, duration = +$("#s-dur").value;
    if (!name || $("#s-price").value === "" || !(duration >= 15 && duration <= 180)) { svcMsg = "أكمل الاسم والسعر، والمدة بين 15 و180 دقيقة"; return renderPanel(); }
    try {
      await addDoc(collection(db, "services"), {
        businessId: uid, businessName: biz.name, category: biz.category, city: biz.city,
        name, price, duration, desc: $("#s-desc").value.trim(),
      });
      await loadServices();
    } catch { svcMsg = "تعذّر إضافة الخدمة. تأكد من تفعيل بريدك الإلكتروني."; }
    renderPanel();
  }

  /* ---------- الملف ---------- */
  const shareLink = () => new URL(`b.html?s=${savedSlug}`, location.href).href;
  function profileHTML() {
    const w = biz.workHours || {}, br = biz.breakTime || {};
    return `<div class="card grid g2">
      <div><label class="label">اسم النشاط</label><input class="input" id="p-name" value="${esc(biz.name)}"></div>
      <div><label class="label">الفئة</label><select class="input" id="p-category">${CATEGORIES.map((c) => `<option ${c === biz.category ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></div>
      <div><label class="label">الهاتف</label><input class="input" dir="ltr" id="p-phone" value="${esc(biz.phone)}"></div>
      <div><label class="label">المدينة</label><input class="input" id="p-city" value="${esc(biz.city)}"></div>
      <div><label class="label">بداية الدوام</label><input type="time" class="input" id="p-from" value="${esc(w.from)}"></div>
      <div><label class="label">نهاية الدوام</label><input type="time" class="input" id="p-to" value="${esc(w.to)}"></div>
      <div><label class="label">بداية الاستراحة (اختياري)</label><input type="time" class="input" id="p-bfrom" value="${esc(br.from || "")}"></div>
      <div><label class="label">نهاية الاستراحة</label><input type="time" class="input" id="p-bto" value="${esc(br.to || "")}"></div>

      <div class="span"><p class="label">أيام العمل</p><div class="row">${WEEKDAYS.map((d, i) =>
        `<label class="chip ${biz.workDays.includes(i) ? "on" : ""}"><input type="checkbox" data-day="${i}" ${biz.workDays.includes(i) ? "checked" : ""}>${d}</label>`).join("")}</div></div>

      <div class="span"><label class="label">أيام الإجازة</label>
        <div class="row"><input type="date" class="input" style="max-width:14rem" id="p-dayoff"><button type="button" class="btn-alt" data-act="add-off">إضافة</button></div>
        <div class="row mt">${biz.daysOff.map((d) => `<button type="button" class="tag" dir="ltr" data-act="del-off" data-v="${esc(d)}">${esc(d)} ✕</button>`).join("")}</div></div>

      <div class="span"><label class="label">الموظفون (لكل موظف جدول مستقل)</label>
        <div class="row"><input class="input" style="max-width:14rem" placeholder="اسم الموظف" id="p-staff"><button type="button" class="btn-alt" data-act="add-staff">إضافة</button></div>
        <div class="row mt">${biz.staff.map((s) => `<button type="button" class="tag" data-act="del-staff" data-id="${esc(s.id)}" ${biz.staff.length === 1 ? "disabled" : ""}>${esc(s.name)}${biz.staff.length > 1 ? " ✕" : ""}</button>`).join("")}</div></div>

      <label class="checkrow span"><input type="checkbox" id="p-auto" ${biz.autoConfirm ? "checked" : ""}><span>قبول الحجوزات تلقائيًا بدون موافقة يدوية</span></label>

      <div class="span"><label class="label">رابط صفحتك العامة (حروف إنجليزية صغيرة وأرقام وشرطة)</label>
        <input class="input" dir="ltr" placeholder="my-salon" id="p-slug" value="${esc(biz.slug || "")}">
        ${savedSlug ? `<div class="row mt" style="gap:1rem">
          <img id="qr" alt="رمز QR لصفحة النشاط" width="120" height="120">
          <div class="stack small"><p dir="ltr" class="teal" style="word-break:break-all">${esc(shareLink())}</p>
            <div class="row"><button type="button" class="btn-alt" data-act="copy">نسخ الرابط</button><a class="btn-alt" id="qr-dl" download="waqti-qr.svg">تنزيل QR</a></div></div>
        </div>` : ""}</div>

      <div class="span row"><button class="btn" data-act="save-profile">حفظ</button><span class="small teal" role="status">${esc(msg)}</span></div>
    </div>`;
  }
  function syncProfile() {
    if (!$("#p-name")) return;
    const v = (id) => $("#" + id).value;
    Object.assign(biz, {
      name: v("p-name").trim(), category: v("p-category"), phone: v("p-phone").trim(), city: v("p-city").trim(),
      workHours: { from: v("p-from"), to: v("p-to") }, breakTime: { from: v("p-bfrom"), to: v("p-bto") },
      autoConfirm: $("#p-auto").checked, slug: v("p-slug").trim().toLowerCase(),
    });
  }
  function drawQR() {
    if (!savedSlug || !$("#qr") || typeof qrcode !== "function") return;
    const q = qrcode(0, "M"); q.addData(shareLink()); q.make();
    const url = "data:image/svg+xml;utf8," + encodeURIComponent(q.createSvgTag(5, 2));
    $("#qr").src = url; $("#qr-dl").href = url;
  }
  async function saveProfile() {
    syncProfile(); msg = "";
    const slug = biz.slug;
    if (!biz.name || !biz.phone || !biz.city) msg = "أكمل الاسم والهاتف والمدينة";
    else if (slug && !/^[a-z0-9-]{3,30}$/.test(slug)) msg = "الرابط: حروف إنجليزية صغيرة وأرقام وشرطة، من 3 إلى 30";
    else {
      try {
        await runTransaction(db, async (tx) => {
          if (slug !== savedSlug) {
            if (slug) {
              const r = doc(db, "slugs", slug), s = await tx.get(r);
              if (s.exists() && s.data().uid !== uid) throw new Error("slug");
              tx.set(r, { uid });
            }
            if (savedSlug) tx.delete(doc(db, "slugs", savedSlug));
          }
          tx.set(doc(db, "businesses", uid), biz);
        });
        const cur = keep();
        if (cur.name !== orig.name || cur.city !== orig.city || cur.category !== orig.category) {
          const s = await getDocs(query(collection(db, "services"), where("businessId", "==", uid)));
          const batch = writeBatch(db);
          s.docs.forEach((d) => batch.update(d.ref, { businessName: biz.name, category: biz.category, city: biz.city }));
          await batch.commit();
          orig = cur;
        }
        savedSlug = slug; msg = "تم الحفظ";
      } catch (x) { msg = x.message === "slug" ? "هذا الرابط مستخدم، اختر غيره" : "تعذّر الحفظ"; }
    }
    renderPanel();
  }

  /* ---------- الإحصائيات ---------- */
  function statsHTML() {
    const week = new Date(Date.now() - 7 * 864e5).toLocaleDateString("sv-SE");
    const confirmed = list.filter((b) => b.date >= week && b.status === "confirmed").length;
    const top = Object.entries(list.filter((b) => b.status === "confirmed")
      .reduce((a, b) => ((a[b.serviceName] = (a[b.serviceName] || 0) + 1), a), {})).sort((x, y) => y[1] - x[1]).slice(0, 3);
    return `<div class="card stack">
      <p>حجوزات مؤكدة آخر 7 أيام: <b>${confirmed}</b></p>
      <p>بانتظار ردك: <b>${pending()}</b></p>
      <div><p class="label">الأكثر طلبًا</p>${top.length ? top.map(([n, c]) => `<p class="small">${esc(n)} — ${c}</p>`).join("") : '<p class="small muted">لا توجد بيانات بعد.</p>'}</div>
    </div>`;
  }

  /* ---------- العرض والأحداث ---------- */
  function renderPanel() {
    $("#panel").innerHTML = { bookings: bookingsHTML, services: servicesHTML, profile: profileHTML, stats: statsHTML }[tab]();
    if (tab === "profile") drawQR();
  }

  $("#panel").addEventListener("change", (e) => {
    const i = e.target.dataset.day;
    if (i === undefined) return;
    const n = +i;
    biz.workDays = e.target.checked ? [...new Set([...biz.workDays, n])] : biz.workDays.filter((x) => x !== n);
    e.target.parentElement.classList.toggle("on", e.target.checked);
  });

  $("#panel").addEventListener("click", async (e) => {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const { act, id, v } = el.dataset;
    try {
      if (["confirm", "reject", "cancel"].includes(act)) {
        el.disabled = true;
        await setBookingStatus(list.find((x) => x.id === id), { confirm: "confirmed", reject: "rejected", cancel: "cancelled" }[act]);
      } else if (act === "reveal") {
        contacts[id] = (await getDoc(doc(db, "bookings", id, "contact", "info"))).data();
        renderPanel();
      } else if (act === "add-service") await addService();
      else if (act === "del-service") { await deleteDoc(doc(db, "services", id)); await loadServices(); renderPanel(); }
      else if (act === "save-profile") await saveProfile();
      else if (act === "copy") navigator.clipboard.writeText(shareLink());
      else if (act === "add-off") {
        syncProfile(); const d = $("#p-dayoff").value;
        if (d && !biz.daysOff.includes(d)) biz.daysOff = [...biz.daysOff, d].sort();
        renderPanel();
      } else if (act === "del-off") { syncProfile(); biz.daysOff = biz.daysOff.filter((x) => x !== v); renderPanel(); }
      else if (act === "add-staff") {
        syncProfile(); const n = $("#p-staff").value.trim();
        if (n) biz.staff = [...biz.staff, { id: "s" + Date.now().toString(36), name: n }];
        renderPanel();
      } else if (act === "del-staff") { syncProfile(); biz.staff = biz.staff.filter((x) => x.id !== id); renderPanel(); }
    } catch { alert("تعذّر تنفيذ الإجراء"); el.disabled = false; }
  });

  /* ---------- لحظي: الحجوزات الواردة ---------- */
  let first = true;
  onSnapshot(query(collection(db, "bookings"), where("businessId", "==", uid)), (s) => {
    if (!first && "Notification" in window && Notification.permission === "granted")
      s.docChanges().forEach((c) => {
        const d = c.doc.data();
        if (c.type === "added" && d.status === "pending") new Notification("حجز جديد", { body: `${d.serviceName} — ${d.date} ${d.time}` });
      });
    first = false;
    list = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    renderTabs();
    if (tab === "bookings" || tab === "stats") renderPanel();
  });

  renderTop(); renderTabs(); renderPanel();
}
