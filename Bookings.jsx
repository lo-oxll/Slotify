import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db, call } from "./firebase";
import { useAuth } from "./auth";
import Guard from "./Guard";
import UpgradeBanner from "./UpgradeBanner";
import { STATUS } from "./constants";
import { gcalLink } from "./slots";

function MyBookings() {
  const { user } = useAuth();
  const [list, setList] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => onSnapshot(query(collection(db, "bookings"), where("clientId", "==", user.uid)), (s) =>
    setList(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)))), [user.uid]);

  const cancel = async (b) => {
    setBusyId(b.id);
    try { await call("updateBooking", { bookingId: b.id, action: "cancel" }); } catch (e) { alert(e.message); }
    setBusyId(null);
  };

  return (
    <>
      <UpgradeBanner />
      {!list && <p className="text-ink/60">جارٍ التحميل…</p>}
      {list?.length === 0 && <p className="text-ink/60">لا توجد حجوزات بعد. <Link to="/services" className="text-teal">تصفح الخدمات</Link> واحجز موعدك الأول.</p>}
      <div className="space-y-3">
        {list?.map((b) => (
          <div key={b.id} className="card flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">{b.serviceName} — {b.businessName}</p>
              <p className="text-sm text-ink/60"><span dir="ltr">{b.date} {b.time}</span> · {b.staffName}</p>
              <p className={`text-sm ${b.status === "confirmed" ? "text-teal" : "text-ink/70"}`}>{STATUS[b.status]}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(b.status === "pending" || b.status === "confirmed") && (
                <>
                  <a className="btn-alt" href={gcalLink(b)} target="_blank" rel="noreferrer">للتقويم</a>
                  <button className="btn-danger" disabled={busyId === b.id} onClick={() => cancel(b)}>إلغاء الموعد</button>
                </>
              )}
              <Link className="btn-alt" to={`/book?id=${b.serviceId}`}>احجز مجددًا</Link>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default function Page() {
  return <Guard role="client"><MyBookings /></Guard>;
}
