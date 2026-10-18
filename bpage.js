import { db, collection, doc, getDoc, getDocs, query, where } from "./firebase.js";
import { $, esc, renderHeader, session } from "./common.js";

renderHeader(await session());
const app = $("#app");
const slug = (new URLSearchParams(location.search).get("s") || "").toLowerCase();
const sl = slug ? await getDoc(doc(db, "slugs", slug)) : null;

if (!sl?.exists()) {
  app.innerHTML = `<p>الصفحة غير موجودة. <a class="teal" href="services.html">تصفح الخدمات</a></p>`;
} else {
  const uid = sl.data().uid;
  const biz = (await getDoc(doc(db, "businesses", uid))).data();
  const sv = await getDocs(query(collection(db, "services"), where("businessId", "==", uid)));
  document.title = `${biz.name} — وقتي`;
  app.innerHTML = `
    <h1>${esc(biz.name)}</h1>
    <p class="small muted mb">${esc(biz.category)} · ${esc(biz.city)} · <span dir="ltr">${esc(biz.phone)}</span></p>
    ${sv.empty ? '<p class="muted">لا توجد خدمات متاحة حاليًا.</p>' : ""}
    <div class="stack">${sv.docs.map((d) => { const x = d.data(); return `
      <a class="card row between" href="book.html?id=${encodeURIComponent(d.id)}">
        <div><p class="title">${esc(x.name)}</p><p class="small muted">${esc(x.price)} · ${esc(x.duration)} دقيقة</p></div>
        <span class="btn">احجز</span>
      </a>`; }).join("")}</div>`;
}
