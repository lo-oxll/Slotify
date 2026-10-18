import { useState } from "react";
import { EmailAuthProvider, GoogleAuthProvider, linkWithCredential, linkWithPopup, sendEmailVerification } from "firebase/auth";
import { auth } from "./firebase";
import { useAuth } from "./auth";

export default function UpgradeBanner() {
  const { user, refresh } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  if (!user?.isAnonymous) return null;

  const withEmail = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      await linkWithCredential(auth.currentUser, EmailAuthProvider.credential(email, password));
      await sendEmailVerification(auth.currentUser);
      await refresh();
    } catch (x) {
      setErr(x.code === "auth/email-already-in-use" ? "هذا البريد مسجّل مسبقًا" : x.code === "auth/weak-password" ? "كلمة المرور يجب ألا تقل عن 6 أحرف" : "تعذّر إنشاء الحساب");
    }
  };
  const withGoogle = async () => {
    setErr("");
    try { await linkWithPopup(auth.currentUser, new GoogleAuthProvider()); await refresh(); }
    catch { setErr("تعذّر الربط بحساب Google"); }
  };

  return (
    <div className="card mb-5 border-teal">
      <p className="font-medium">احفظ حجوزاتك</p>
      <p className="text-sm text-ink/70">أنت تتصفح كضيف. أنشئ حسابًا لتصل إلى حجوزاتك من أي جهاز.</p>
      {!open ? (
        <div className="mt-3 flex gap-2">
          <button className="btn" onClick={() => setOpen(true)}>إنشاء حساب</button>
          <button className="btn-alt" onClick={withGoogle}>المتابعة بحساب Google</button>
        </div>
      ) : (
        <form onSubmit={withEmail} className="mt-3 grid gap-3 sm:grid-cols-3">
          <input className="input" dir="ltr" type="email" required placeholder="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input" dir="ltr" type="password" required minLength={6} placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="btn">حفظ الحساب</button>
        </form>
      )}
      {err && <p role="alert" className="mt-2 text-sm text-coral">{err}</p>}
    </div>
  );
}
