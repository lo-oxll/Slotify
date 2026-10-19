import {
  auth, db, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signInWithPopup, sendEmailVerification, signOut, doc, getDoc, setDoc,
} from "./firebase.js";
import { $, esc, CATEGORIES, HOME, PHONE_RE, cleanPhone, renderHeader, session } from "./common.js";

const ERR = {
  "auth/invalid-credential": "البريد أو كلمة المرور غير صحيحة",
  "auth/email-already-in-use": "هذا البريد مسجّل مسبقًا",
  "auth/weak-password": "كلمة المرور يجب ألا تقل عن 6 أحرف",
  "auth/invalid-email": "البريد الإلكتروني غير صالح",
  "auth/popup-closed-by-user": "",
};

const role = new URLSearchParams(location.search).get("role");
const app = $("#app");

async function main() {
  if (role !== "client" && role !== "business") { app.innerHTML = "<p>صفحة غير موجودة</p>"; return; }
  const isBiz = role === "business";
  let mode = "login", step = "auth";
  const f = { email: "", password: "", name: "", phone: "", category: CATEGORIES[0], city: "", terms: false };

  const s = await session();
  renderHeader({ user: null, profile: null });
  if (s.user && !s.user.isAnonymous) {
    if (s.profile) return location.replace(HOME[s.profile.role]);
    step = "complete"; f.name = s.user.displayName || "";
  }

  const setErr = (m) => { $("#err").textContent = m || ""; };
  const setBusy = (b) => app.querySelectorAll("button").forEach((x) => (x.disabled = b));

  const validate = () => {
    const phone = cleanPhone(f.phone);
    if (!PHONE_RE.test(phone)) throw new Error("أدخل رقم هاتف صحيح مع رمز الدولة، مثال: +966500000000");
    if (!f.terms) throw new Error("يجب الموافقة على الشروط وسياسة الخصوصية");
    return phone;
  };
  const createProfile = async (u) => {
    const phone = validate();
    await setDoc(doc(db, "users", u.uid), { role, name: f.name.trim(), phone });
    if (isBiz)
      await setDoc(doc(db, "businesses", u.uid), {
        name: f.name.trim(), category: f.category, phone, city: f.city.trim(),
        workHours: { from: "09:00", to: "17:00" }, workDays: [0, 1, 2, 3, 4, 5, 6], daysOff: [],
        staff: [{ id: "main", name: "الجميع" }], autoConfirm: false, slug: "",
      });
  };
  const checkRole = async (u) => {
    const d = await getDoc(doc(db, "users", u.uid));
    if (!d.exists()) return false;
    if (d.data().role !== role) {
      await signOut(auth);
      throw new Error(`هذا الحساب مسجّل كـ ${d.data().role === "business" ? "نشاط تجاري" : "عميل"}، استخدم الباب الآخر`);
    }
    return true;
  };
  const enter = async () => {
    let dest = HOME[role];
    if (role === "client" && !(await getDoc(doc(db, "cvs", auth.currentUser.uid))).exists()) dest = "cv.html";
    location.href = dest;
  };
  const run = async (fn) => {
    setErr(""); setBusy(true);
    try { await fn(); } catch (x) { setErr(ERR[x.code] ?? x.message); }
    setBusy(false);
  };

  function render() {
    const showProfile = step === "complete" || mode === "register";
    app.innerHTML = `
      <h1>${step === "complete" ? "أكمل بياناتك" : isBiz ? "دخول الأنشطة التجارية" : "دخول العملاء"}</h1>
      <form id="f" class="card stack" novalidate>
        ${showProfile ? `
          <div><label class="label">${isBiz ? "اسم النشاط" : "الاسم"}</label><input class="input" data-k="name" value="${esc(f.name)}"></div>
          <div><label class="label">رقم الهاتف (مطلوب)</label><input class="input" dir="ltr" type="tel" placeholder="+966500000000" data-k="phone" value="${esc(f.phone)}"></div>
          ${isBiz ? `
            <div><label class="label">الفئة</label><select class="input" data-k="category">${CATEGORIES.map((c) => `<option ${c === f.category ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></div>
            <div><label class="label">المدينة</label><input class="input" data-k="city" value="${esc(f.city)}"></div>` : ""}` : ""}
        ${step === "auth" ? `
          <div><label class="label">البريد الإلكتروني</label><input class="input" dir="ltr" type="email" data-k="email" value="${esc(f.email)}"></div>
          <div><label class="label">كلمة المرور</label><input class="input" dir="ltr" type="password" data-k="password" value="${esc(f.password)}"></div>` : ""}
        ${showProfile ? `<label class="checkrow"><input type="checkbox" data-k="terms" ${f.terms ? "checked" : ""}><span>أوافق على <a class="teal" href="terms.html">الشروط</a> و<a class="teal" href="privacy.html">سياسة الخصوصية</a></span></label>` : ""}
        <p id="err" class="err" role="alert"></p>
        <button class="btn block">${step === "complete" ? "حفظ ومتابعة" : mode === "login" ? "دخول" : "إنشاء حساب"}</button>
        ${step === "auth" ? `
          <button type="button" class="btn-alt block" id="google">المتابعة بحساب Google</button>
          <button type="button" class="btn-alt block" id="switch" style="border:0;color:var(--teal)">${mode === "login" ? "ليس لديك حساب؟ سجّل الآن" : "لديك حساب؟ سجّل الدخول"}</button>` : ""}
      </form>`;

    app.querySelectorAll("[data-k]").forEach((el) =>
      el.addEventListener("input", () => { f[el.dataset.k] = el.type === "checkbox" ? el.checked : el.value; }));

    $("#switch")?.addEventListener("click", () => { mode = mode === "login" ? "register" : "login"; render(); });
    $("#google")?.addEventListener("click", () => run(async () => {
      const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
      if (await checkRole(user)) return enter();
      f.name = user.displayName || ""; step = "complete"; render();
    }));
    $("#f").addEventListener("submit", (e) => {
      e.preventDefault();
      run(async () => {
        if (step === "complete") { await createProfile(auth.currentUser); return enter(); }
        if (!f.email || !f.password) throw new Error("أدخل البريد وكلمة المرور");
        if (mode === "login") {
          const { user } = await signInWithEmailAndPassword(auth, f.email, f.password);
          if (!(await checkRole(user))) throw new Error("لا يوجد ملف لهذا الحساب، سجّل حسابًا جديدًا");
          return enter();
        }
        if (f.name.trim().length < 2) throw new Error("أدخل الاسم");
        if (isBiz && !f.city.trim()) throw new Error("أدخل المدينة");
        validate();
        const { user } = await createUserWithEmailAndPassword(auth, f.email, f.password);
        await sendEmailVerification(user);
        await createProfile(user);
        enter();
      });
    });
  }
  render();
}
main();
