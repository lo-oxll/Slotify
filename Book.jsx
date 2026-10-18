import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { signInAnonymously } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { auth, db, call } from "./firebase";
import { useAuth } from "./auth";
import Header from "./Header";
import { PHONE_RE, candidateTimes, cleanPhone, freeStaff, nowTime, staffOf, today } from "./slots";

export default function Book() {
  const [sp] = useSearchParams();
  const id = sp.get("id");
  const navigate = useNavigate();
  const { user, profile, refresh } = useAuth();
  const [svc, setSvc] = useState(null);
  const [biz, setBiz] = useState(null);
  const [date, setDate] = useState(today());
  const [busySet, setBusySet] = useState(new Set());
  const [time, setTime] = useState("");
  const [staff, setStaff] = useState("any");
  const [f, setF] = useState({ name: "", phone: "", email: "", terms: false });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) return setSvc(false);
      const s = await getDoc(doc(db, "services", id));
      if (!s.exists()) return setSvc(false);
      setSvc({ id, ...s.data() });
      setBiz((await getDoc(doc(db, "businesses", s.data().businessId))).data());
    })();
  }, [id]);

  useEffect(() => {
    if (profile?.role === "client") setF((p) => ({ ...p, name: p.name || profile.name || "", phone: p.phone || profile.phone || "" }));
  }, [profile]);

  const loadBusy = async () => {
    const s = await getDocs(query(collection(db, "busy"), where("businessId", "==", svc.businessId), where("date", "==", date)));
    setBusySet(new Set(s.docs.map((d) => `${d.data().staffId}_${d.data().time}`)));
  };
  useEffect(() => { if (svc) { setTime(""); loadBusy(); } }, [svc, date]);

  const times = useMemo(() => {
    if (!svc || !biz) return [];
    return candidateTimes(biz, svc.duration, date)
      .filter((t) => date > today() || t > nowTime())
      .filter((t) => freeStaff(busySet, biz, t, svc.duration).some((s) => staff === "any" || s.id === staff));
  }, [svc, biz, date, busySet, staff]);

  if (svc === false) return <><Header /><p className="p-8">الخدمة غير موجودة. <Link to="/services" className="text-teal">العودة للخدمات</Link></p></>;
  if (!svc || !biz) return <><Header /><p className="p-8 text-ink/60">جارٍ التحميل…</p></>;

  const staffList = staffOf(biz);
  const isBiz = profile?.role === "business";
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function confirm() {
    setErr("");
    const phone = cleanPhone(f.phone);
    if (f.name.trim().length < 2) return setErr("أدخل اسمك");
    if (!PHONE_RE.test(phone)) return setErr("رقم الهاتف مطلوب لإتمام الحجز، أدخله مع رمز الدولة مثل +966500000000");
    if (!user && !f.terms) return setErr("يجب الموافقة على الشروط وسياسة الخصوصية");
    setBusy(true);
    try {
      if (!auth.currentUser) await signInAnonymously(auth);
      await call("createBooking", { serviceId: svc.id, date, time, staffId: staff, name: f.name.trim(), phone, email: f.email.trim() });
      await refresh();
      navigate("/bookings", { replace: true });
    } catch (e) {
      setErr(e.message || "تعذّر إتمام الحجز، حاول مرة أخرى");
      setTime("");
      loadBusy();
      setBusy(false);
    }
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-xl space-y-5 px-4 py-6">
        <div className="card">
          <h1 className="text-xl font-bold">{svc.name}</h1>
          <p className="text-sm text-ink/70">{biz.name} · {biz.city} · <span dir="ltr">{biz.phone}</span></p>
          {svc.desc && <p className="mt-2 text-sm">{svc.desc}</p>}
          <p className="mt-3 font-medium text-teal">{svc.price} · {svc.duration} دقيقة</p>
        </div>

        {isBiz ? (
          <p className="card text-sm">أنت مسجّل كنشاط تجاري. للحجز استخدم حساب عميل.</p>
        ) : (
          <div className="card space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">اليوم</label>
                <input type="date" className="input" min={today()} value={date} onChange={(e) => setDate(e.target.value || today())} />
              </div>
              {staffList.length > 1 && (
                <div>
                  <label className="label">الموظف</label>
                  <select className="input" value={staff} onChange={(e) => { setStaff(e.target.value); setTime(""); }}>
                    <option value="any">أي موظف</option>
                    {staffList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div>
              <p className="label">الأوقات المتاحة</p>
              {times.length === 0 ? (
                <p className="text-sm text-ink/60">لا توجد أوقات متاحة في هذا اليوم. جرّب يومًا آخر.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {times.map((t) => (
                    <button key={t} type="button" dir="ltr" aria-pressed={time === t} onClick={() => setTime(t)}
                      className={`rounded-lg border px-4 py-2 text-sm ${time === t ? "border-teal bg-teal text-white" : "border-line bg-white hover:border-teal"}`}>{t}</button>
                  ))}
                </div>
              )}
            </div>

            {time && (
              <div className="space-y-3 border-t border-line pt-4">
                <div><label className="label">الاسم</label><input className="input" value={f.name} onChange={set("name")} /></div>
                <div>
                  <label className="label">رقم الهاتف (مطلوب)</label>
                  <input className="input" dir="ltr" type="tel" placeholder="+966500000000" value={f.phone} onChange={set("phone")} />
                </div>
                <div>
                  <label className="label">البريد الإلكتروني (اختياري، للتذكير)</label>
                  <input className="input" dir="ltr" type="email" value={f.email} onChange={set("email")} />
                </div>
                {!user && (
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-1" checked={f.terms} onChange={(e) => setF({ ...f, terms: e.target.checked })} />
                    <span>أوافق على <Link to="/terms" className="text-teal">الشروط</Link> و<Link to="/privacy" className="text-teal">سياسة الخصوصية</Link></span>
                  </label>
                )}
              </div>
            )}
            {err && <p role="alert" className="text-sm text-coral">{err}</p>}
            <button className="btn w-full" disabled={!time || busy} onClick={confirm}>{busy ? "جارٍ الحجز…" : "تأكيد الحجز"}</button>
          </div>
        )}
      </main>
    </>
  );
}
