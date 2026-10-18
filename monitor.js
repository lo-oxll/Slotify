import { addDoc, collection } from "firebase/firestore";
import { auth, db } from "./firebase";

let sent = 0;
// أخطاء الواجهة تُسجَّل في مجموعة errors (للمستخدمين المسجّلين) وتُراجع من لوحة Firebase
export function report(err) {
  if (!auth.currentUser || sent++ > 5) return;
  addDoc(collection(db, "errors"), {
    msg: String(err?.message || err).slice(0, 500),
    stack: String(err?.stack || "").slice(0, 1500),
    url: location.pathname,
    ts: Date.now(),
  }).catch(() => {});
}
