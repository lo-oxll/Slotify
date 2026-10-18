import { db, collection, getDocs, limit, query, startAfter, where } from "./firebase.js";
import { $, esc, CATEGORIES, renderHeader, session } from "./common.js";

renderHeader(await session());
const PAGE = 12;
let items = [], last = null, more = false, cat = "";

$("#app").classList.remove("narrow");
$("#app").innerHTML = `
  <div class="grid g4 mb">
    <input class="input" id="q" placeholder="ابحث عن خدمة أو نشاط">
    <select class="input" id="cat"><option value="">كل الفئات</option>${CATEGORIES.map((c) => `<option>${esc(c)}</option>`).join("")}</select>
    <input class="input" id="city" placeholder="المدينة">
    <input class="input" id="max" type="number" min="0" placeholder="أقصى سعر">
  </div>
  <p id="state" class="muted"></p>
  <div id="list" class="grid g2"></div>
  <button class="btn-alt mt" id="more" hidden>تحميل المزيد</button>`;

function render(loading) {
  const q = $("#q").value.trim(), city = $("#city").value.trim(), max = $("#max").value;
  const shown = items.filter((x) =>
    (!q || `${x.name} ${x.businessName}`.includes(q)) &&
    (!city || (x.city || "").includes(city)) &&
    (!max || x.price <= +max));
  $("#state").textContent = loading && !items.length ? "جارٍ التحميل…" : !shown.length ? "لا توجد خدمات مطابقة. جرّب تغيير الفلاتر." : "";
  $("#list").innerHTML = shown.map((x) => `
    <a class="card" href="book.html?id=${encodeURIComponent(x.id)}">
      <p class="title">${esc(x.name)}</p>
      <p class="small muted">${esc(x.businessName)} · ${esc(x.category)} · ${esc(x.city)}</p>
      ${x.desc ? `<p class="small muted mt">${esc(x.desc)}</p>` : ""}
      <p class="price">${esc(x.price)} · ${esc(x.duration)} دقيقة</p>
    </a>`).join("");
  $("#more").hidden = !more;
  $("#more").disabled = !!loading;
}

async function load(reset) {
  if (reset) { last = null; items = []; }
  render(true);
  const cons = [];
  if (cat) cons.push(where("category", "==", cat));
  if (last) cons.push(startAfter(last));
  const s = await getDocs(query(collection(db, "services"), ...cons, limit(PAGE)));
  if (s.docs.length) last = s.docs[s.docs.length - 1];
  items = items.concat(s.docs.map((d) => ({ id: d.id, ...d.data() })));
  more = s.docs.length === PAGE;
  render(false);
}

["q", "city", "max"].forEach((id) => $("#" + id).addEventListener("input", () => render(false)));
$("#cat").addEventListener("change", (e) => { cat = e.target.value; load(true); });
$("#more").addEventListener("click", () => load(false));
load(true);
