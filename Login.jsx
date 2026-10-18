import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  GoogleAuthProvider, createUserWithEmailAndPassword, sendEmailVerification,
  signInWithEmailAndPassword, signInWithPopup, signOut,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { useAuth } from "./auth";
import { CATEGORIES } from "./constants";
import { PHONE_RE, cleanPhone } from "./slots";

const ERR = {
  "auth/invalid-credential": "البريد أو كلمة المرور غير صحيحة",
  "auth/email-already-in-use": "هذا البريد مسجّل مسبقًا",
  "auth/weak-password": "كلمة المرور يجب ألا تقل عن 6 أحرف",
  "auth/invalid-email": "البريد الإلكتروني غير صالح",
  "auth/popup-closed-by-user": "",
};

export default function Login() {
  const [sp] = useSearchParams();
  const role = sp.get("role");
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const isBiz = role === "business";
  const [mode, setMode] = useState("login");
  const [step, setStep] = useState("auth"); // auth | complete (بعد Google لحساب جديد)
  const [f, setF] = useState({ email: "", password: "", name: "", phone: "", category: CATEGORIES[0], city: "", terms: false });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  if (role !== "business" && role !== "client") return <p className="p-10">صفحة غير موجودة</p>;

  const validate = () => {
    const phone = cleanPhone(f.phone);
    if (!PHONE_RE.test(phone)) throw new Error("أدخل رقم هاتف صحيح مع رمز الدولة، مثال: +966500000000");
    if (!f.terms) throw new Error("يجب الموافقة على الشروط وسياسة الخصوصية");
    return phone;
  };

  const createProfile = async (u) => {
    const phone = validate();
    await setDoc(doc(db, "users", u.uid), { role, name: f.name, phone });
    if (isBiz)
      await setDoc(doc(db, "businesses", u.uid), {
        name: f.name, category: f.category, phone, city: f.city,
        workHours: { from: "09:00", to: "17:00" }, workDays: [0, 1, 2, 3, 4, 5, 6], daysOff: [],
        staff: [{ id: "main", name: "الجميع" }], autoConfirm: false, slug: "",
      });
  };

  // true إذا كان للحساب ملف بنفس الدور
  const checkRole = async (u) => {
    const s = await getDoc(doc(db, "users", u.uid));
    if (!s.exists()) return false;
    if (s.data().role !== role) {
      await signOut(auth);
      throw new Error(`هذا الحساب مسجّل كـ ${s.data().role === "business" ? "نشاط تجاري" : "عميل"}، استخدم الباب الآخر`);
    }
    return true;
  };

  const enter = async () => { await refresh(); navigate(role === "business" ? "/business" : "/services", { replace: true }); };

  async function submit(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      if (step === "complete") { await createProfile(auth.currentUser); await enter(); }
      else if (mode === "login") {
        const { user } = await signInWithEmailAndPassword(auth, f.email, f.password);
        if (!(await checkRole(user))) throw new Error("لا يوجد ملف لهذا الحساب، سجّل حسابًا جديدًا");
        await enter();
      } else {
        validate();
        const { user } = await createUserWithEmailAndPassword(auth, f.email, f.password);
        await sendEmailVerification(user);
        await createProfile(user);
        await enter();
      }
    } catch (x) { setErr(ERR[x.code] ?? x.message); }
    finally { setBusy(false); }
  }

  async function google() {
    setErr(""); setBusy(true);
    try {
      const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
      if (await checkRole(user)) await enter();
      else { setF((p) => ({ ...p, name: user.displayName || "" })); setStep("complete"); }
    } catch (x) { setErr(ERR[x.code] ?? x.message); }
    finally { setBusy(false); }
  }

  const showProfile = step === "complete" || mode === "register";

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <Link to="/" className="text-2xl font-bold text-teal">وقتي</Link>
      <h1 className="mb-6 mt-4 text-2xl font-bold">
        {step === "complete" ? "أكمل بياناتك" : isBiz ? "دخول الأنشطة التجارية" : "دخول العملاء"}
      </h1>
      <form onSubmit={submit} className="card space-y-4">
        {showProfile && (
          <>
            <div>
              <label className="label">{isBiz ? "اسم النشاط" : "الاسم"}</label>
              <input className="input" required value={f.name} onChange={set("name")} />
            </div>
            <div>
              <label className="label">رقم الهاتف (مطلوب)</label>
              <input className="input" dir="ltr" type="tel" required placeholder="+966500000000" value={f.phone} onChange={set("phone")} />
            </div>
            {isBiz && (
              <>
                <div>
                  <label className="label">الفئة</label>
                  <select className="input" value={f.category} onChange={set("category")}>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">المدينة</label>
                  <input className="input" required value={f.city} onChange={set("city")} />
                </div>
              </>
            )}
          </>
        )}
        {step === "auth" && (
          <>
            <div>
              <label className="label">البريد الإلكتروني</label>
              <input className="input" dir="ltr" type="email" required value={f.email} onChange={set("email")} />
            </div>
            <div>
              <label className="label">كلمة المرور</label>
              <input className="input" dir="ltr" type="password" required minLength={6} value={f.password} onChange={set("password")} />
            </div>
          </>
        )}
        {showProfile && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={f.terms} onChange={(e) => setF({ ...f, terms: e.target.checked })} />
            <span>أوافق على <Link to="/terms" className="text-teal">الشروط</Link> و<Link to="/privacy" className="text-teal">سياسة الخصوصية</Link></span>
          </label>
        )}
        {err && <p role="alert" className="text-sm text-coral">{err}</p>}
        <button className="btn w-full" disabled={busy}>
          {busy ? "جارٍ المعالجة…" : step === "complete" ? "حفظ ومتابعة" : mode === "login" ? "دخول" : "إنشاء حساب"}
        </button>
        {step === "auth" && (
          <>
            <button type="button" className="btn-alt w-full" disabled={busy} onClick={google}>المتابعة بحساب Google</button>
            <button type="button" className="w-full text-sm text-teal" onClick={() => setMode(mode === "login" ? "register" : "login")}>
              {mode === "login" ? "ليس لديك حساب؟ سجّل الآن" : "لديك حساب؟ سجّل الدخول"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
