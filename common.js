import { isDemo, auth, db, onAuthStateChanged, signOut, doc, getDoc, setDoc, writeBatch, addDoc, collection } from "./firebase.js";
import { blocksOf, busyDocId } from "./slots.js";

export * from "./slots.js";
export * from "./match.js";
export const CATEGORIES = ["صالون", "عيادة", "ورشة", "تعليم خصوصي", "أخرى"];
export const STATUS = { pending: "قيد الانتظار", confirmed: "مؤكد", rejected: "مرفوض", cancelled: "ملغي" };
export const WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
export const HOME = { business: "business.html", client: "home.html" };

// مسار داخلي آمن فقط للعودة بعد الدخول
export const safeNext = (n) => (/^[A-Za-z0-9_-]+\.html(\?[A-Za-z0-9_=&%.-]*)?$/.test(n || "") ? n : null);
const here = () => location.pathname.split("/").pop() + location.search;

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
    : role === "client" ? [["home.html", "لوحتي"], ["services.html", "الخدمات"], ["jobs.html", "الوظائف"], ["bookings.html", "حجوزاتي"], ["cv.html", "سيرتي"]]
    : [["services.html", "الخدمات"], ["jobs.html", "الوظائف"], ["login.html?role=client", "دخول الأفراد"], ["login.html?role=business", "للشركات والأنشطة"]];
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
  if (!s.user || !s.profile) { location.replace(`login.html?role=${role}&next=${encodeURIComponent(here())}`); return null; }
  if (s.profile.role !== role) { location.replace(HOME[s.profile.role]); return null; }
  return s;
}

// تقديم على وظيفة (مفتاح الوثيقة jobId_candidateId يمنع التكرار)
export async function applyToJob(job, cv, { user, profile }, scoreValue) {
  const data = {
    jobId: job.id, jobTitle: job.title, businessId: job.businessId, businessName: job.businessName,
    candidateId: user.uid, name: cv.name, phone: profile.phone, email: user.email || cv.contact || "",
    cvTitle: cv.title, score: scoreValue, status: "new", createdAt: Date.now(),
  };
  await setDoc(doc(db, "applications", `${job.id}_${user.uid}`), data);
  return data;
}

export async function setBookingStatus(b, status) {
  const batch = writeBatch(db);
  batch.update(doc(db, "bookings", b.id), { status });
  if (status !== "confirmed")
    blocksOf(b.time, b.duration).forEach((t) => batch.delete(doc(db, "busy", busyDocId(b.businessId, b.staffId, b.date, t))));
  await batch.commit();
}

if (isDemo)
  document.body.insertAdjacentHTML("afterbegin",
    '<div class="demo">وضع تجريبي: البيانات محفوظة في هذا المتصفح فقط. لربط قاعدة بيانات حقيقية عبّئ <b>config.js</b>. <a href="#" id="demo-reset">إعادة ضبط</a></div>');
$("#demo-reset")?.addEventListener("click", (e) => {
  e.preventDefault();
  if (confirm("حذف كل البيانات التجريبية؟")) { Object.keys(localStorage).filter((k) => k.startsWith("waqti_demo")).forEach((k) => localStorage.removeItem(k)); location.href = "index.html"; }
});

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
