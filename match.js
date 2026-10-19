// نظام موحّد للسير الذاتية والوظائف + خوارزمية المطابقة (دوال نقية)
export const EDU = ["بدون", "ثانوي", "دبلوم", "بكالوريوس", "ماجستير", "دكتوراه"];
export const JOB_TYPES = ["دوام كامل", "دوام جزئي", "عن بعد"];
export const RECOMMEND = 30; // أدنى درجة للترشيح التلقائي
export const APP_STATUS = { new: "قيد المراجعة", shortlisted: "تم ترشيحك", rejected: "غير مناسب" };

export const norm = (s) => String(s ?? "").toLowerCase()
  .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
  .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
  .replace(/[^\p{L}\p{N}+#.\s]/gu, " ").replace(/\s+/g, " ").trim();
const toks = (s) => norm(s).split(" ").map((t) => t.replace(/^\.+|\.+$/g, "")).filter(Boolean);

export function parseSkills(text) {
  const seen = new Set(), out = [];
  for (const p of String(text || "").split(/[,،;\n|/]+/)) {
    const t = p.trim().replace(/\s+/g, " "), n = norm(t);
    if (t && n && !seen.has(n)) { seen.add(n); out.push(t.slice(0, 40)); }
    if (out.length >= 30) break;
  }
  return out;
}

const rank = (e) => Math.max(0, EDU.indexOf(e));

// الدرجة من 100: مهارات 55 + خبرة 20 + مؤهل 10 + مدينة 10 + مسمى 5
export function score(job, cv) {
  const direct = new Set((cv.skills || []).map(norm));
  const cvTok = new Set([...(cv.skills || []), cv.title, cv.summary].flatMap(toks));
  const has = (s) => direct.has(norm(s)) || (toks(s).length > 0 && toks(s).every((t) => cvTok.has(t)));
  const js = job.skills || [];
  const matched = js.filter(has), missing = js.filter((s) => !has(s));
  const jt = toks(job.title), titlePart = jt.length ? jt.filter((t) => cvTok.has(t)).length / jt.length : 0;
  const skillPart = js.length ? matched.length / js.length : titlePart;
  const expPart = job.minYears > 0 ? Math.min(1, (+cv.years || 0) / job.minYears) : 1;
  const need = rank(job.education), have = rank(cv.education);
  const eduPart = have >= need ? 1 : have === need - 1 ? 0.5 : 0;
  const cityPart = job.type === "عن بعد" ? 1 : !job.city || !cv.city ? 0.5 : norm(job.city) === norm(cv.city) ? 1 : 0;
  // الخبرة والمؤهل والمدينة لا تُحتسب كاملة إلا مع توافق مهارات حقيقي
  const gate = Math.min(1, skillPart * 2);
  let total = 100 * (0.55 * skillPart + gate * (0.2 * expPart + 0.1 * eduPart + 0.1 * cityPart + 0.05 * titlePart));
  if (cv.jobType && cv.jobType !== "أي" && cv.jobType !== job.type) total *= 0.85;
  return { score: Math.round(total), matched, missing };
}
export const rankJobsFor = (cv, jobs) => jobs.map((job) => ({ job, ...score(job, cv) })).sort((a, b) => b.score - a.score);
export const rankCandidates = (job, cvs) => cvs.map((cv) => ({ cv, ...score(job, cv) })).sort((a, b) => b.score - a.score);
