import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, limit, query, startAfter, where } from "firebase/firestore";
import { db } from "./firebase";
import Header from "./Header";
import { CATEGORIES } from "./constants";

const PAGE = 12;

export default function Browse() {
  const [items, setItems] = useState([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [city, setCity] = useState("");
  const [max, setMax] = useState("");
  const last = useRef(null);

  async function load(reset) {
    setLoading(true);
    const cons = [];
    if (cat) cons.push(where("category", "==", cat));
    if (!reset && last.current) cons.push(startAfter(last.current));
    const s = await getDocs(query(collection(db, "services"), ...cons, limit(PAGE)));
    if (s.docs.length) last.current = s.docs[s.docs.length - 1];
    const rows = s.docs.map((d) => ({ id: d.id, ...d.data() }));
    setItems((p) => (reset ? rows : [...p, ...rows]));
    setMore(s.docs.length === PAGE);
    setLoading(false);
  }
  useEffect(() => { last.current = null; load(true); }, [cat]);

  const shown = useMemo(() => items.filter((x) =>
    (!q || `${x.name} ${x.businessName}`.includes(q)) &&
    (!city || (x.city || "").includes(city)) &&
    (!max || x.price <= +max)), [items, q, city, max]);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-5 grid gap-3 sm:grid-cols-4">
          <input className="input" placeholder="ابحث عن خدمة أو نشاط" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">كل الفئات</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input className="input" placeholder="المدينة" value={city} onChange={(e) => setCity(e.target.value)} />
          <input className="input" type="number" min="0" placeholder="أقصى سعر" value={max} onChange={(e) => setMax(e.target.value)} />
        </div>
        {loading && items.length === 0 && <p className="text-ink/60">جارٍ التحميل…</p>}
        {!loading && shown.length === 0 && <p className="text-ink/60">لا توجد خدمات مطابقة. جرّب تغيير الفلاتر.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          {shown.map((x) => (
            <Link key={x.id} to={`/book?id=${x.id}`} className="card block transition hover:border-teal">
              <p className="text-lg font-medium">{x.name}</p>
              <p className="text-sm text-ink/70">{x.businessName} · {x.category} · {x.city}</p>
              {x.desc && <p className="mt-2 text-sm text-ink/60">{x.desc}</p>}
              <p className="mt-3 font-medium text-teal">{x.price} · {x.duration} دقيقة</p>
            </Link>
          ))}
        </div>
        {more && <button className="btn-alt mt-5" disabled={loading} onClick={() => load(false)}>{loading ? "جارٍ التحميل…" : "تحميل المزيد"}</button>}
      </main>
    </>
  );
}
