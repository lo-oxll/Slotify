import { setGlobalOptions } from "firebase-functions/v2";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import admin from "firebase-admin";
import { candidateTimes, blocksOf, staffOf, PHONE_RE } from "./slots.js";

admin.initializeApp();
const db = admin.firestore();
const TZ = process.env.APP_TZ || "Asia/Riyadh";
const MAX_PENDING = 3;
setGlobalOptions({ region: process.env.FN_REGION || "us-central1", maxInstances: 10 });

// يتطلب إضافة Firebase "Trigger Email from Firestore"
const mail = (to, subject, text) => (to ? db.collection("mail").add({ to, message: { subject, text } }) : null);
const tzNow = (plus) => new Date(Date.now() + plus).toLocaleString("sv-SE", { timeZone: TZ }).slice(0, 16);
const busyRef = (biz, staff, date, time) => db.doc(`busy/${biz}_${staff}_${date}_${time}`);

export const createBooking = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "سجّل الدخول أو تابع كضيف");
  const { serviceId, date, time, staffId, name, phone, email } = req.data || {};

  if (!serviceId || !/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !/^\d{2}:\d{2}$/.test(time || ""))
    throw new HttpsError("invalid-argument", "بيانات الحجز غير مكتملة");
  const cleanName = String(name || "").trim().slice(0, 60);
  if (cleanName.length < 2) throw new HttpsError("invalid-argument", "أدخل اسمك");
  const cleanPhone = String(phone || "").replace(/[\s-]/g, "");
  if (!PHONE_RE.test(cleanPhone)) throw new HttpsError("invalid-argument", "رقم الهاتف مطلوب لإتمام الحجز، أدخله مع رمز الدولة");
  const mailTo = /^\S+@\S+\.\S+$/.test(email || "") ? String(email).slice(0, 120) : null;
  if (date < new Date(Date.now() - 864e5).toISOString().slice(0, 10))
    throw new HttpsError("invalid-argument", "لا يمكن الحجز في تاريخ سابق");

  const svcSnap = await db.doc(`services/${serviceId}`).get();
  if (!svcSnap.exists) throw new HttpsError("not-found", "الخدمة غير موجودة");
  const svc = svcSnap.data();
  const biz = (await db.doc(`businesses/${svc.businessId}`).get()).data();
  if (!biz) throw new HttpsError("not-found", "النشاط غير موجود");
  if (svc.businessId === uid) throw new HttpsError("failed-precondition", "لا يمكنك حجز خدمة نشاطك");
  if (!candidateTimes(biz, svc.duration, date).includes(time))
    throw new HttpsError("failed-precondition", "هذا الوقت غير متاح للحجز");

  const pending = await db.collection("bookings").where("clientId", "==", uid).where("status", "==", "pending").count().get();
  if (pending.data().count >= MAX_PENDING)
    throw new HttpsError("resource-exhausted", `لديك ${MAX_PENDING} حجوزات بانتظار الموافقة، انتظر الرد عليها أولًا`);

  const staff = staffOf(biz);
  const wanted = staffId && staffId !== "any" ? staff.filter((s) => s.id === staffId) : staff;
  if (!wanted.length) throw new HttpsError("invalid-argument", "الموظف غير موجود");
  const blocks = blocksOf(time, svc.duration);
  const bookingRef = db.collection("bookings").doc();
  const status = biz.autoConfirm ? "confirmed" : "pending";

  await db.runTransaction(async (tx) => {
    const userRef = db.doc(`users/${uid}`);
    const u = await tx.get(userRef);
    if (u.exists && u.data().role !== "client")
      throw new HttpsError("permission-denied", "هذا حساب نشاط تجاري، استخدم حساب عميل");

    const refs = wanted.flatMap((s) => blocks.map((b) => busyRef(svc.businessId, s.id, date, b)));
    const snaps = await tx.getAll(...refs);
    const free = wanted.find((s, i) =>
      snaps.slice(i * blocks.length, (i + 1) * blocks.length).every((x) => !x.exists));
    if (!free) throw new HttpsError("already-exists", "هذا الوقت حُجز للتو، اختر وقتًا آخر");

    blocks.forEach((b) =>
      tx.set(busyRef(svc.businessId, free.id, date, b), { businessId: svc.businessId, staffId: free.id, date, time: b }));
    tx.set(bookingRef, {
      serviceId, serviceName: svc.name, businessId: svc.businessId, businessName: biz.name,
      clientId: uid, clientName: cleanName, date, time, duration: svc.duration,
      staffId: free.id, staffName: free.name, status, reminded: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.set(bookingRef.collection("contact").doc("info"), { name: cleanName, phone: cleanPhone, email: mailTo });
    tx.set(userRef, { role: "client", name: cleanName, phone: cleanPhone }, { merge: true });
  });

  try {
    const owner = await admin.auth().getUser(svc.businessId);
    await mail(owner.email, "حجز جديد", `${cleanName} حجز ${svc.name} يوم ${date} الساعة ${time}. ${status === "pending" ? "بانتظار موافقتك من لوحة النشاط." : "تم تأكيده تلقائيًا."}`);
    if (status === "confirmed")
      await mail(mailTo, "تم تأكيد حجزك", `${svc.name} لدى ${biz.name} — ${date} ${time}`);
  } catch (e) { console.error(e); }

  return { id: bookingRef.id, status };
});

export const updateBooking = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "سجّل الدخول أولًا");
  const { bookingId, action } = req.data || {};
  if (!bookingId || !["confirm", "reject", "cancel"].includes(action))
    throw new HttpsError("invalid-argument", "طلب غير صالح");
  const ref = db.doc(`bookings/${bookingId}`);

  const out = await db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists) throw new HttpsError("not-found", "الحجز غير موجود");
    const b = s.data();
    const isBiz = b.businessId === uid, isCl = b.clientId === uid;
    if (!isBiz && !isCl) throw new HttpsError("permission-denied", "غير مسموح");
    let status;
    if (action === "confirm" && isBiz && b.status === "pending") status = "confirmed";
    else if (action === "reject" && isBiz && b.status === "pending") status = "rejected";
    else if (action === "cancel" && ["pending", "confirmed"].includes(b.status)) status = "cancelled";
    else throw new HttpsError("failed-precondition", "لا يمكن تنفيذ هذا الإجراء على الحجز بحالته الحالية");
    tx.update(ref, { status });
    if (status !== "confirmed")
      blocksOf(b.time, b.duration).forEach((x) => tx.delete(busyRef(b.businessId, b.staffId, b.date, x)));
    return { b, status, isBiz };
  });

  try {
    const { b, status, isBiz } = out;
    const label = { confirmed: "تم تأكيد", rejected: "تم رفض", cancelled: "تم إلغاء" }[status];
    const text = `${label} الحجز: ${b.serviceName} — ${b.date} ${b.time}`;
    if (isBiz) {
      const c = (await ref.collection("contact").doc("info").get()).data();
      await mail(c?.email, "تحديث على حجزك", `${text} لدى ${b.businessName}`);
    } else {
      const owner = await admin.auth().getUser(b.businessId);
      await mail(owner.email, "تحديث على حجز", `${text} (العميل: ${b.clientName})`);
    }
  } catch (e) { console.error(e); }

  return { status: out.status };
});

export const reminders = onSchedule("every 60 minutes", async () => {
  const now = tzNow(0), limit = tzNow(24 * 3600e3);
  const snap = await db.collection("bookings").where("date", "in", [...new Set([now.slice(0, 10), limit.slice(0, 10)])]).get();
  for (const d of snap.docs) {
    const b = d.data(), k = `${b.date} ${b.time}`;
    if (b.status !== "confirmed" || b.reminded || k <= now || k > limit) continue;
    const c = (await d.ref.collection("contact").doc("info").get()).data();
    await mail(c?.email, "تذكير بموعدك", `موعدك: ${b.serviceName} لدى ${b.businessName} — ${b.date} الساعة ${b.time}`);
    await d.ref.update({ reminded: true });
  }
});

// المقياس الرئيسي: الحجوزات المؤكدة في آخر 7 أيام
export const dailyStats = onSchedule("every day 03:00", async () => {
  const from = tzNow(-7 * 864e5).slice(0, 10);
  const snap = await db.collection("bookings").where("date", ">=", from).get();
  let confirmed = 0;
  snap.forEach((d) => { if (d.data().status === "confirmed") confirmed++; });
  await db.doc("stats/last7days").set({ confirmed, total: snap.size, at: admin.firestore.FieldValue.serverTimestamp() });
});

export const syncServices = onDocumentWritten("businesses/{uid}", async (ev) => {
  const a = ev.data.after?.data();
  if (!a) return;
  const b = ev.data.before?.data();
  if (b && b.name === a.name && b.city === a.city && b.category === a.category) return;
  const s = await db.collection("services").where("businessId", "==", ev.params.uid).get();
  const batch = db.batch();
  s.docs.forEach((d) => batch.update(d.ref, { businessName: a.name, city: a.city, category: a.category }));
  await batch.commit();
});
