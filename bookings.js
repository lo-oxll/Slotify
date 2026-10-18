import {
  auth, db, EmailAuthProvider, GoogleAuthProvider, linkWithCredential, linkWithPopup, sendEmailVerification,
  collection, onSnapshot, query, where,
} from "./firebase.js";
import { $, esc, guard, STATUS, gcalLink, setBookingStatus } from "./common.js";

const S = await guard("client");
if (S) main();

function main() {
  const app = $("#app");
  app.innerHTML = `<div id="upgrade"></div><p id="state" class="muted">جارٍ التحميل…</p><div id="list" class="stack"></div>`;
  let list = [];

  if (S.user.isAnonymous) {
    $("#upgrade").innerHTML = `
      <div class="card hl mb">
        <p class="title">احفظ حجوزاتك</p>
        <p class="small muted">أنت تتصفح كضيف. أنشئ حسابًا لتصل إلى حجوزاتك من أي جهاز.</p>
        <div class="row mt" id="up-actions">
          <button class="btn" id="up-open">إنشاء حساب</button>
          <button class="btn-alt" id="up-google">المتابعة بحساب Google</button>
        </div>
        <form id="up-form" class="grid g3 mt" hidden>
          <input class="input" dir="ltr" type="email" required placeholder="البريد الإلكتروني" id="up-email">
          <input class="input" dir="ltr" type="password" required minlength="6" placeholder="كلمة المرور" id="up-pass">
          <button class="btn">حفظ الحساب</button>
        </form>
        <p class="err mt" id="up-err" role="alert"></p>
      </div>`;
    $("#up-open").onclick = () => { $("#up-form").hidden = false; $("#up-actions").hidden = true; };
    $("#up-google").onclick = async () => {
      try { await linkWithPopup(auth.currentUser, new GoogleAuthProvider()); location.reload(); }
      catch { $("#up-err").textContent = "تعذّر الربط بحساب Google"; }
    };
    $("#up-form").onsubmit = async (e) => {
      e.preventDefault();
      try {
        await linkWithCredential(auth.currentUser, EmailAuthProvider.credential($("#up-email").value, $("#up-pass").value));
        await sendEmailVerification(auth.currentUser);
        location.reload();
      } catch (x) {
        $("#up-err").textContent = x.code === "auth/email-already-in-use" ? "هذا البريد مسجّل مسبقًا"
          : x.code === "auth/weak-password" ? "كلمة المرور يجب ألا تقل عن 6 أحرف" : "تعذّر إنشاء الحساب";
      }
    };
  }

  function render() {
    $("#state").textContent = list.length ? "" : "لا توجد حجوزات بعد.";
    if (!list.length) $("#state").innerHTML = 'لا توجد حجوزات بعد. <a class="teal" href="services.html">تصفح الخدمات</a> واحجز موعدك الأول.';
    $("#list").innerHTML = list.map((b) => `
      <div class="card row between">
        <div>
          <p class="title">${esc(b.serviceName)} — ${esc(b.businessName)}</p>
          <p class="small muted"><span dir="ltr">${esc(b.date)} ${esc(b.time)}</span> · ${esc(b.staffName)}</p>
          <p class="small ${b.status === "confirmed" ? "teal" : "muted"}">${STATUS[b.status]}</p>
        </div>
        <div class="row">
          ${b.status === "pending" || b.status === "confirmed" ? `
            <a class="btn-alt" href="${esc(gcalLink(b))}" target="_blank" rel="noopener">للتقويم</a>
            <button class="btn-danger" data-cancel="${esc(b.id)}">إلغاء الموعد</button>` : ""}
          <a class="btn-alt" href="book.html?id=${encodeURIComponent(b.serviceId)}">احجز مجددًا</a>
        </div>
      </div>`).join("");
  }

  $("#list").addEventListener("click", async (e) => {
    const el = e.target.closest("[data-cancel]");
    if (!el) return;
    el.disabled = true;
    try { await setBookingStatus(list.find((x) => x.id === el.dataset.cancel), "cancelled"); }
    catch { alert("تعذّر إلغاء الموعد"); el.disabled = false; }
  });

  onSnapshot(query(collection(db, "bookings"), where("clientId", "==", S.user.uid)), (s) => {
    list = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    render();
  });
}
