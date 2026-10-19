import { db, doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "./firebase.js";
import { $, esc, guard, EDU, JOB_TYPES, parseSkills, cvCompleteness, safeNext } from "./common.js";

const S = await guard("client");
if (S) await main();

async function main() {
  const uid = S.user.uid, app = $("#app");
  const snap = await getDoc(doc(db, "cvs", uid));
  const isNew = !snap.exists();
  const cv = isNew
    ? { name: S.profile.name || "", title: "", city: "", years: 0, education: "بكالوريوس", jobType: "أي", skills: [], languages: "", salary: "", summary: "", contact: "", open: true }
    : snap.data();

  app.innerHTML = `
    <h1>سيرتي الذاتية</h1>
    <p class="small muted mb">نموذج واحد موحّد لكل الباحثين عن عمل. نرشّح لك الوظائف المناسبة تلقائيًا، وترشّحك الشركات بحسب مهاراتك.</p>
    <div class="card stack">
      <div class="row between"><span class="small muted">اكتمال السيرة</span><b id="pct" class="teal"></b></div>
      <div class="grid g2">
        <div><label class="label" for="name">الاسم</label><input class="input" id="name" maxlength="80" value="${esc(cv.name)}"></div>
        <div><label class="label" for="title">المسمى الوظيفي</label><input class="input" id="title" maxlength="80" placeholder="مثال: مطوّر ويب، محاسب، مصفف شعر" value="${esc(cv.title)}"></div>
        <div><label class="label" for="city">المدينة</label><input class="input" id="city" maxlength="60" value="${esc(cv.city)}"></div>
        <div><label class="label" for="years">سنوات الخبرة</label><input class="input" type="number" id="years" min="0" max="50" value="${esc(cv.years)}"></div>
        <div><label class="label" for="edu">المؤهل العلمي</label><select class="input" id="edu">${EDU.map((e) => `<option ${e === cv.education ? "selected" : ""}>${esc(e)}</option>`).join("")}</select></div>
        <div><label class="label" for="jtype">نوع الدوام المفضّل</label><select class="input" id="jtype">${["أي", ...JOB_TYPES].map((e) => `<option ${e === cv.jobType ? "selected" : ""}>${esc(e)}</option>`).join("")}</select></div>
      </div>
      <div><label class="label" for="skills">المهارات (افصل بينها بفاصلة)</label>
        <textarea class="input" id="skills" rows="2" placeholder="مثال: JavaScript, React, خدمة العملاء, إكسل">${esc(cv.skills.join("، "))}</textarea>
        <div class="row mt" id="chips"></div></div>
      <div class="grid g2">
        <div><label class="label" for="langs">اللغات (اختياري)</label><input class="input" id="langs" maxlength="100" value="${esc(cv.languages)}"></div>
        <div><label class="label" for="salary">الراتب المتوقع (اختياري)</label><input class="input" id="salary" maxlength="40" value="${esc(cv.salary)}"></div>
      </div>
      <div><label class="label" for="summary">نبذة عنك</label><textarea class="input" id="summary" rows="4" maxlength="1000">${esc(cv.summary)}</textarea></div>
      <div><label class="label" for="contact">وسيلة تواصل تظهر للشركات (اختياري)</label><input class="input" id="contact" maxlength="100" placeholder="بريد أو رقم — اتركه فارغًا لإخفائه" value="${esc(cv.contact)}"></div>
      <label class="checkrow"><input type="checkbox" id="open" ${cv.open ? "checked" : ""}><span>اجعل سيرتي ظاهرة للشركات (للترشيح التلقائي)</span></label>
      <p class="err" id="err" role="alert"></p>
      <div class="row"><button class="btn" id="save">حفظ السيرة</button>
        ${isNew ? "" : `<button class="btn-danger" id="del">حذف السيرة</button>`}
        <span class="small teal" id="ok" role="status"></span></div>
    </div>`;

  const read = () => ({
    uid, name: $("#name").value.trim(), title: $("#title").value.trim(), city: $("#city").value.trim(),
    years: Math.max(0, Math.min(50, +$("#years").value || 0)), education: $("#edu").value, jobType: $("#jtype").value,
    skills: parseSkills($("#skills").value), languages: $("#langs").value.trim(), salary: $("#salary").value.trim(),
    summary: $("#summary").value.trim(), contact: $("#contact").value.trim(), open: $("#open").checked,
  });
  const paint = () => {
    const c = read();
    $("#chips").innerHTML = c.skills.map((s) => `<span class="tag ok">${esc(s)}</span>`).join("");
    $("#pct").textContent = cvCompleteness(c) + "%";
  };
  app.addEventListener("input", paint);
  paint();

  $("#save").addEventListener("click", async () => {
    const c = read();
    $("#ok").textContent = ""; $("#err").textContent = "";
    if (c.name.length < 2 || c.title.length < 2 || !c.city || !c.skills.length) {
      $("#err").textContent = "أكمل الاسم والمسمى الوظيفي والمدينة ومهارة واحدة على الأقل";
      return;
    }
    try {
      await setDoc(doc(db, "cvs", uid), { ...c, updatedAt: serverTimestamp() });
      const next = safeNext(new URLSearchParams(location.search).get("next"));
      if (next) return (location.href = next);
      $("#ok").innerHTML = 'تم الحفظ — <a class="teal" href="jobs.html">شاهد الوظائف المناسبة لك</a>';
    } catch { $("#err").textContent = "تعذّر الحفظ، حاول مرة أخرى"; }
  });
  $("#del")?.addEventListener("click", async () => {
    if (!confirm("حذف سيرتك الذاتية؟ لن ترشّحك الشركات بعد ذلك.")) return;
    await deleteDoc(doc(db, "cvs", uid));
    location.reload();
  });
}
