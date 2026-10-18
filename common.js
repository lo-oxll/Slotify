import { auth, db, onAuthStateChanged, signOut, doc, getDoc, writeBatch, addDoc, collection } from "./firebase.js";
import { blocksOf, busyDocId } from "./slots.js";

export * from "./slots.js";
export const CATEGORIES = ["صالون", "عيادة", "ورشة", "تعليم خصوصي", "أخرى"];
export const STATUS = { pending: "قيد الانتظار", confirmed: "مؤكد", rejected: "مرفوض", cancelled: "ملغي" };
export const WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
export const HOME = { business: "business.html", client: "services.html" };

export const $ = (s, r = document) => r.querySelector(s);
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function session() {
  return new Promise((resolve) => {
    const off = onAuthStateChanged(auth, async (user) => {
      off();
      let profile = null;
      if (user) {
        const s = await getDoc(doc(db, "users", user.uid));
        profile = s.exists() ? s.data() : null;
      }
      resolve({ user, profile });
    });
  });
}

export function renderHeader({ user, profile }) {
  const role = profile?.role;
  const links =
    role === "business" ? [["business.html", "لوحة النشاط"]]
    : role === "client" ? [["services.html", "الخدمات"], ["bookings.html", "حجوزاتي"]]
    : [["services.html", "الخدمات"], ["login.html?role=client", "دخول العملاء"], ["login.html?role=business", "للأنشطة"]];
  $("#hdr").innerHTML = `<div class="wrap bar"><a href="index.html" class="logo">وقتي</a><nav>${links
    .map(([h, t]) => `<a href="${h}">${t}</a>`).join("")}${user ? '<button class="btn-alt" id="logout">خروج</button>' : ""}</nav></div>`;
  $("#logout")?.addEventListener("click", async () => {
    if (user.isAnonymous && !confirm("سيفقد هذا الجهاز الوصول إلى حجوزاتك إن لم تنشئ حسابًا. هل تريد الخروج؟")) return;
    await signOut(auth);
    location.href = "index.html";
  });
}

// يحمي صفحة بدور معيّن؛ يعيد الجلسة أو null بعد التحويل
export async function guard(role) {
  const s = await session();
  renderHeader(s);
  if (!s.user || !s.profile) { location.replace(`login.html?role=${role}`); return null; }
  if (s.profile.role !== role) { location.replace(HOME[s.profile.role]); return null; }
  return s;
}

export async function setBookingStatus(b, status) {
  const batch = writeBatch(db);
  batch.update(doc(db, "bookings", b.id), { status });
  if (status !== "confirmed")
    blocksOf(b.time, b.duration).forEach((t) => batch.delete(doc(db, "busy", busyDocId(b.businessId, b.staffId, b.date, t))));
  await batch.commit();
}

// تسجيل أخطاء الواجهة في مجموعة errors (للمسجّلين فقط)
let sent = 0;
const report = (e) => {
  if (!auth.currentUser || sent++ > 5) return;
  addDoc(collection(db, "errors"), {
    msg: String(e?.message || e).slice(0, 500), stack: String(e?.stack || "").slice(0, 1500),
    url: location.pathname, ts: Date.now(),
  }).catch(() => {});
};
addEventListener("error", (e) => report(e.error || e.message));
addEventListener("unhandledrejection", (e) => report(e.reason));
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
