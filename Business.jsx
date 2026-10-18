import { useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, runTransaction, where } from "firebase/firestore";
import { sendEmailVerification } from "firebase/auth";
import QRCode from "qrcode";
import { auth, db, call } from "./firebase";
import { useAuth } from "./auth";
import Guard from "./Guard";
import { CATEGORIES, STATUS, WEEKDAYS } from "./constants";
import { gcalLink } from "./slots";

const RESERVED = ["login", "business", "services", "bookings", "book", "terms", "privacy", "api"];

function VerifyBanner({ onVerified }) {
  const [msg, setMsg] = useState("");
  if (auth.currentUser?.emailVerified) return null;
  const send = async () => { await sendEmailVerification(auth.currentUser); setMsg("أُرسل رابط التحقق إلى بريدك"); };
  const check = async () => {
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true);
    onVerified();
  };
  return (
    <div className="card mb-5 border-coral">
      <p className="font-medium">فعّل بريدك الإلكتروني لتتمكن من نشر الخدمات</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className="btn-alt" onClick={send}>إرسال رابط التحقق</button>
        <button className="btn-alt" onClick={check}>تحققت، حدّث الحالة</button>
        <span className="text-sm text-teal">{msg}</span>
      </div>
    </div>
  );
}

function Profile({ uid }) {
  const [b, setB] = useState(null);
  const [old, setOld] = useState("");
  const [msg, setMsg] = useState("");
  const [dayOff, setDayOff] = useState("");
  const [staffName, setStaffName] = useState("");
  const [qr, setQr] = useState("");

  useEffect(() => { getDoc(doc(db, "businesses", uid)).then((s) => { setB(s.data()); setOld(s.data().slug || ""); }); }, [uid]);
  const link = b?.slug && typeof window !== "undefined" ? `${location.origin}${import.meta.env.BASE_URL}${b.slug}` : "";
  useEffect(() => { if (link && b.slug === old) QRCode.toDataURL(link, { width: 240, margin: 1 }).then(setQr); else setQr(""); }, [link, old, b?.slug]);
  if (!b) return null;

  const set = (k) => (e) => setB({ ...b, [k]: e.target.value });
  const setH = (k, key) => (e) => setB({ ...b, [k]: { ...(b[k] || {}), [key]: e.target.value } });
  const toggleDay = (i) => setB({ ...b, workDays: b.workDays.includes(i) ? b.workDays.filter((x) => x !== i) : [...b.workDays, i] });

  const save = async (e) => {
    e.preventDefault();
    setMsg("");
    const slug = (b.slug || "").trim().toLowerCase();
    if (slug && !/^[a-z0-9-]{3,30}$/.test(slug)) return setMsg("الرابط: حروف إنجليزية صغيرة وأرقام وشرطة، من 3 إلى 30");
    if (RESERVED.includes(slug)) return setMsg("هذا الاسم محجوز، اختر غيره");
    try {
      await runTransaction(db, async (tx) => {
        if (slug !== old) {
          if (slug) {
            const r = doc(db, "slugs", slug), s = await tx.get(r);
            if (s.exists() && s.data().uid !== uid) throw new Error("slug");
            tx.set(r, { uid });
          }
          if (old) tx.delete(doc(db, "slugs", old));
        }
        tx.set(doc(db, "businesses", uid), { ...b, slug });
      });
      setOld(slug); setB({ ...b, slug }); setMsg("تم الحفظ");
    } catch (x) { setMsg(x.message === "slug" ? "هذا الرابط مستخدم، اختر غيره" : "تعذّر الحفظ"); }
  };

  return (
    <form onSubmit={save} className="card grid gap-4 sm:grid-cols-2">
      <div><label className="label">اسم النشاط</label><input className="input" required value={b.name} onChange={set("name")} /></div>
      <div><label className="label">الفئة</label>
        <select className="input" value={b.category} onChange={set("category")}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
      <div><label className="label">الهاتف</label><input className="input" dir="ltr" required value={b.phone} onChange={set("phone")} /></div>
      <div><label className="label">المدينة</label><input className="input" required value={b.city} onChange={set("city")} /></div>
      <div><label className="label">بداية الدوام</label><input type="time" className="input" value={b.workHours.from} onChange={setH("workHours", "from")} /></div>
      <div><label className="label">نهاية الدوام</label><input type="time" className="input" value={b.workHours.to} onChange={setH("workHours", "to")} /></div>
      <div><label className="label">بداية الاستراحة (اختياري)</label><input type="time" className="input" value={b.breakTime?.from || ""} onChange={setH("breakTime", "from")} /></div>
      <div><label className="label">نهاية الاستراحة</label><input type="time" className="input" value={b.breakTime?.to || ""} onChange={setH("breakTime", "to")} /></div>

      <fieldset className="sm:col-span-2">
        <legend className="label">أيام العمل</legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((d, i) => (
            <label key={d} className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${b.workDays.includes(i) ? "border-teal bg-teal text-white" : "border-line bg-white"}`}>
              <input type="checkbox" className="sr-only" checked={b.workDays.includes(i)} onChange={() => toggleDay(i)} />{d}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="sm:col-span-2">
        <label className="label">أيام الإجازة</label>
        <div className="flex gap-2">
          <input type="date" className="input" value={dayOff} onChange={(e) => setDayOff(e.target.value)} />
          <button type="button" className="btn-alt" onClick={() => { if (dayOff && !b.daysOff.includes(dayOff)) setB({ ...b, daysOff: [...b.daysOff, dayOff].sort() }); setDayOff(""); }}>إضافة</button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {b.daysOff.map((d) => (
            <button type="button" key={d} dir="ltr" className="rounded-lg bg-paper px-3 py-1 text-sm" onClick={() => setB({ ...b, daysOff: b.daysOff.filter((x) => x !== d) })}>{d} ✕</button>
          ))}
        </div>
      </div>

      <div className="sm:col-span-2">
        <label className="label">الموظفون (لكل موظف جدول مستقل)</label>
        <div className="flex gap-2">
          <input className="input" placeholder="اسم الموظف" value={staffName} onChange={(e) => setStaffName(e.target.value)} />
          <button type="button" className="btn-alt" onClick={() => { if (staffName.trim()) setB({ ...b, staff: [...b.staff, { id: "s" + Date.now().toString(36), name: staffName.trim() }] }); setStaffName(""); }}>إضافة</button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {b.staff.map((s) => (
            <button type="button" key={s.id} className="rounded-lg bg-paper px-3 py-1 text-sm" disabled={b.staff.length === 1}
              onClick={() => setB({ ...b, staff: b.staff.filter((x) => x.id !== s.id) })}>{s.name} {b.staff.length > 1 && "✕"}</button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 sm:col-span-2">
        <input type="checkbox" checked={!!b.autoConfirm} onChange={(e) => setB({ ...b, autoConfirm: e.target.checked })} />
        <span>قبول الحجوزات تلقائيًا بدون موافقة يدوية</span>
      </label>

      <div className="sm:col-span-2">
        <label className="label">رابط صفحتك العامة</label>
        <div className="flex items-center gap-2" dir="ltr">
          <span className="text-sm text-ink/60">/</span>
          <input className="input" placeholder="my-salon" value={b.slug || ""} onChange={(e) => setB({ ...b, slug: e.target.value.toLowerCase() })} />
        </div>
        {link && qr && (
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <img src={qr} alt="رمز QR لصفحة النشاط" width={120} height={120} />
            <div className="space-y-2 text-sm">
              <p dir="ltr" className="break-all text-teal">{link}</p>
              <div className="flex gap-2">
                <button type="button" className="btn-alt" onClick={() => navigator.clipboard.writeText(link)}>نسخ الرابط</button>
                <a className="btn-alt" href={qr} download="waqti-qr.png">تنزيل QR</a>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 sm:col-span-2"><button className="btn">حفظ</button><span className="text-sm text-teal">{msg}</span></div>
    </form>
  );
}

function Services({ uid, verified }) {
  const [list, setList] = useState([]);
  const [f, setF] = useState({ name: "", price: "", duration: "30", desc: "" });
  const [err, setErr] = useState("");
  const load = async () => {
    const s = await getDocs(query(collection(db, "services"), where("businessId", "==", uid)));
    setList(s.docs.map((d) => ({ id: d.id, ...d.data() })));
  };
  useEffect(() => { load(); }, [uid]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const add = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      const biz = (await getDoc(doc(db, "businesses", uid))).data();
      await addDoc(collection(db, "services"), {
        businessId: uid, businessName: biz.name, category: biz.category, city: biz.city,
        name: f.name, price: +f.price, duration: +f.duration, desc: f.desc,
      });
      setF({ name: "", price: "", duration: "30", desc: "" });
      load();
    } catch { setErr("تعذّر إضافة الخدمة. تأكد من تفعيل بريدك الإلكتروني."); }
  };
  return (
    <div className="space-y-4">
      <form onSubmit={add} className="card grid gap-4 sm:grid-cols-3">
        <div><label className="label">اسم الخدمة</label><input className="input" required value={f.name} onChange={set("name")} /></div>
        <div><label className="label">السعر</label><input type="number" min="0" className="input" required value={f.price} onChange={set("price")} /></div>
        <div><label className="label">المدة (دقيقة)</label><input type="number" min="15" step="5" className="input" required value={f.duration} onChange={set("duration")} /></div>
        <div className="sm:col-span-3"><label className="label">الوصف</label><input className="input" value={f.desc} onChange={set("desc")} /></div>
        {err && <p role="alert" className="text-sm text-coral sm:col-span-3">{err}</p>}
        <div className="sm:col-span-3"><button className="btn" disabled={!verified}>إضافة الخدمة</button></div>
      </form>
      {list.length === 0 && <p className="text-ink/60">لم تضف أي خدمة بعد. أضف خدمتك الأولى ليراها العملاء.</p>}
      {list.map((s) => (
        <div key={s.id} className="card flex items-center justify-between gap-3">
          <div>
            <p className="font-medium">{s.name}</p>
            <p className="text-sm text-ink/60">{s.price} · {s.duration} دقيقة{s.desc && ` · ${s.desc}`}</p>
          </div>
          <button className="btn-danger" onClick={async () => { await deleteDoc(doc(db, "services", s.id)); load(); }}>حذف</button>
        </div>
      ))}
    </div>
  );
}

function Bookings({ list }) {
  const [contacts, setContacts] = useState({});
  const [busyId, setBusyId] = useState(null);
  const act = async (b, action) => {
    setBusyId(b.id);
    try { await call("updateBooking", { bookingId: b.id, action }); } catch (e) { alert(e.message); }
    setBusyId(null);
  };
  const reveal = async (b) => {
    const s = await getDoc(doc(db, "bookings", b.id, "contact", "info"));
    setContacts((c) => ({ ...c, [b.id]: s.data() }));
  };
  if (list.length === 0) return <p className="text-ink/60">لا توجد حجوزات واردة بعد. شارك رابط صفحتك مع عملائك من تبويب «الملف».</p>;
  return (
    <div className="space-y-3">
      {list.map((b) => {
        const c = contacts[b.id];
        return (
          <div key={b.id} className="card space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{b.serviceName} — {b.clientName}</p>
                <p className="text-sm text-ink/60"><span dir="ltr">{b.date} {b.time}</span> · {b.staffName}</p>
                <p className="text-sm text-teal">{STATUS[b.status]}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {b.status === "pending" && (
                  <>
                    <button className="btn" disabled={busyId === b.id} onClick={() => act(b, "confirm")}>قبول</button>
                    <button className="btn-danger" disabled={busyId === b.id} onClick={() => act(b, "reject")}>رفض</button>
                  </>
                )}
                {b.status === "confirmed" && (
                  <>
                    {!c && <button className="btn-alt" onClick={() => reveal(b)}>عرض رقم العميل</button>}
                    <a className="btn-alt" href={gcalLink(b)} target="_blank" rel="noreferrer">للتقويم</a>
                    <button className="btn-danger" disabled={busyId === b.id} onClick={() => act(b, "cancel")}>إلغاء</button>
                  </>
                )}
              </div>
            </div>
            {c && (
              <div className="flex flex-wrap gap-3 text-sm">
                <a className="text-teal" dir="ltr" href={`tel:${c.phone}`}>{c.phone}</a>
                <a className="text-teal" href={`https://wa.me/${c.phone.replace(/^\+/, "")}`} target="_blank" rel="noreferrer">واتساب</a>
              </div>
            )}
            {b.status === "pending" && <p className="text-xs text-ink/50">يظهر رقم العميل بعد قبول الحجز.</p>}
          </div>
        );
      })}
    </div>
  );
}

function Stats({ list }) {
  const week = new Date(Date.now() - 7 * 864e5).toLocaleDateString("sv-SE");
  const confirmed = list.filter((b) => b.date >= week && b.status === "confirmed").length;
  const pending = list.filter((b) => b.status === "pending").length;
  const top = Object.entries(list.filter((b) => b.status === "confirmed").reduce((a, b) => ((a[b.serviceName] = (a[b.serviceName] || 0) + 1), a), {}))
    .sort((x, y) => y[1] - x[1]).slice(0, 3);
  return (
    <div className="card space-y-3">
      <p>حجوزات مؤكدة آخر 7 أيام: <b>{confirmed}</b></p>
      <p>بانتظار ردك: <b>{pending}</b></p>
      <div>
        <p className="label">الأكثر طلبًا</p>
        {top.length === 0 ? <p className="text-sm text-ink/60">لا توجد بيانات بعد.</p> : top.map(([n, c]) => <p key={n} className="text-sm">{n} — {c}</p>)}
      </div>
    </div>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState("bookings");
  const [list, setList] = useState([]);
  const [, force] = useState(0);

  useEffect(() => {
    let first = true;
    return onSnapshot(query(collection(db, "bookings"), where("businessId", "==", user.uid)), (s) => {
      if (!first && "Notification" in window && Notification.permission === "granted")
        s.docChanges().forEach((c) => {
          const d = c.doc.data();
          if (c.type === "added" && d.status === "pending") new Notification("حجز جديد", { body: `${d.serviceName} — ${d.date} ${d.time}` });
        });
      first = false;
      setList(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)));
    });
  }, [user.uid]);

  const pending = list.filter((b) => b.status === "pending").length;
  const tabs = { bookings: `الحجوزات${pending ? ` (${pending})` : ""}`, services: "الخدمات", profile: "الملف", stats: "الإحصائيات" };
  return (
    <>
      <VerifyBanner onVerified={() => force((n) => n + 1)} />
      {"Notification" in globalThis && Notification.permission === "default" && (
        <button className="btn-alt mb-4" onClick={() => Notification.requestPermission().then(() => force((n) => n + 1))}>فعّل تنبيهات الحجوزات الجديدة</button>
      )}
      <div className="mb-5 flex flex-wrap gap-2" role="tablist">
        {Object.entries(tabs).map(([k, v]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === k ? "bg-ink text-white" : "border border-line bg-white"}`}>{v}</button>
        ))}
      </div>
      {tab === "bookings" && <Bookings list={list} />}
      {tab === "services" && <Services uid={user.uid} verified={!!auth.currentUser?.emailVerified} />}
      {tab === "profile" && <Profile uid={user.uid} />}
      {tab === "stats" && <Stats list={list} />}
    </>
  );
}

export default function Page() {
  return <Guard role="business"><Dashboard /></Guard>;
}
