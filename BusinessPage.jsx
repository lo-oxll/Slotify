import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";
import Header from "./Header";

export default function BusinessPage() {
  const { slug } = useParams();
  const [biz, setBiz] = useState(null);
  const [services, setServices] = useState([]);

  useEffect(() => {
    (async () => {
      const s = await getDoc(doc(db, "slugs", slug));
      if (!s.exists()) return setBiz(false);
      const uid = s.data().uid;
      setBiz((await getDoc(doc(db, "businesses", uid))).data());
      const sv = await getDocs(query(collection(db, "services"), where("businessId", "==", uid)));
      setServices(sv.docs.map((d) => ({ id: d.id, ...d.data() })));
    })();
  }, [slug]);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-6">
        {biz === null && <p className="text-ink/60">جارٍ التحميل…</p>}
        {biz === false && <p>الصفحة غير موجودة. <Link to="/services" className="text-teal">تصفح الخدمات</Link></p>}
        {biz && (
          <>
            <h1 className="text-2xl font-bold">{biz.name}</h1>
            <p className="mb-5 text-sm text-ink/70">{biz.category} · {biz.city} · <span dir="ltr">{biz.phone}</span></p>
            {services.length === 0 && <p className="text-ink/60">لا توجد خدمات متاحة حاليًا.</p>}
            <div className="space-y-3">
              {services.map((x) => (
                <Link key={x.id} to={`/book?id=${x.id}`} className="card flex items-center justify-between transition hover:border-teal">
                  <div>
                    <p className="font-medium">{x.name}</p>
                    <p className="text-sm text-ink/60">{x.price} · {x.duration} دقيقة</p>
                  </div>
                  <span className="btn">احجز</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
