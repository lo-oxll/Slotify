// منطق المواعيد (دوال نقية بلا اعتماديات)
export const B = 15;
const m = (t) => { const [h, mm] = t.split(":").map(Number); return h * 60 + mm; };
const hm = (n) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

export const staffOf = (biz) => (biz.staff?.length ? biz.staff : [{ id: "main", name: "الجميع" }]);
export const blocksOf = (time, dur) => {
  const n = Math.ceil(dur / B), s = m(time);
  return Array.from({ length: n }, (_, i) => hm(s + i * B));
};
export const busyDocId = (biz, staff, date, time) => `${biz}_${staff}_${date}_${time}`;

export function candidateTimes(biz, dur, date) {
  const dow = new Date(`${date}T00:00:00`).getDay();
  if (!(biz.workDays || [0, 1, 2, 3, 4, 5, 6]).includes(dow) || (biz.daysOff || []).includes(date)) return [];
  const len = Math.ceil(dur / B) * B, to = m(biz.workHours.to), br = biz.breakTime;
  const out = [];
  for (let t = m(biz.workHours.from); t + len <= to; t += len) {
    if (br?.from && br?.to && t < m(br.to) && t + len > m(br.from)) continue;
    out.push(hm(t));
  }
  return out;
}

// busy: Set من "staffId_HH:MM"
export const freeStaff = (busy, biz, time, dur) =>
  staffOf(biz).filter((s) => blocksOf(time, dur).every((b) => !busy.has(`${s.id}_${b}`)));

export const today = () => new Date().toLocaleDateString("sv-SE");
export const nowTime = () => new Date().toTimeString().slice(0, 5);
export const PHONE_RE = /^\+?[0-9]{8,15}$/;
export const cleanPhone = (p) => p.replace(/[\s-]/g, "");

export const gcalLink = (b) => {
  const s = new Date(`${b.date}T${b.time}:00`);
  const e = new Date(s.getTime() + b.duration * 60000);
  const f = (d) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${b.serviceName} - ${b.businessName}`)}&dates=${f(s)}/${f(e)}`;
};
