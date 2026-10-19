// وضع تجريبي: يحاكي Firebase (Auth + Firestore) باستخدام localStorage — البيانات داخل هذا المتصفح فقط
const DB = "waqti_demo_db", USERS = "waqti_demo_users", CUR = "waqti_demo_current";
const read = (k) => JSON.parse(localStorage.getItem(k) || "{}");
const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 20);
const err = (code) => Object.assign(new Error(code), { code });
const clone = (v) => (v === undefined ? undefined : structuredClone(v));

/* ---------------- Firestore ---------------- */
export const db = {};
const listeners = new Set();
const notify = () => listeners.forEach((l) => l());
if (typeof window !== "undefined") window.addEventListener("storage", (e) => { if (e.key === DB) notify(); });

const mk = (path) => ({ type: "doc", path, id: path.split("/").pop() });
const snapOf = (path, data) => ({ id: path.split("/").pop(), ref: mk(path), exists: () => data !== undefined, data: () => clone(data) });

export const collection = (_db, ...segs) => ({ type: "col", path: segs.join("/") });
export function doc(base, ...segs) {
  if (base === db) return mk(segs.join("/"));
  if (base.type === "col") return mk(`${base.path}/${segs.length ? segs.join("/") : uid()}`);
  return mk(`${base.path}/${segs.join("/")}`);
}
export const where = (f, op, v) => ({ t: "where", f, op, v });
export const limit = (n) => ({ t: "limit", n });
export const startAfter = (snap) => ({ t: "after", id: snap.id });
export const query = (col, ...cons) => ({ col, cons });
export const serverTimestamp = () => Date.now();

const OPS = { "==": (a, b) => a === b, ">=": (a, b) => a >= b, "<=": (a, b) => a <= b, ">": (a, b) => a > b, "<": (a, b) => a < b };
const norm = (x) => (x.type === "col" ? { col: x, cons: [] } : x);
function run(q) {
  const d = read(DB), col = q.col.path, depth = col.split("/").length + 1;
  let rows = Object.entries(d).filter(([p]) => p.startsWith(col + "/") && p.split("/").length === depth);
  q.cons.filter((c) => c.t === "where").forEach((c) => { rows = rows.filter(([, v]) => OPS[c.op](v[c.f], c.v)); });
  rows.sort(([a], [b]) => (a < b ? -1 : 1));
  const after = q.cons.find((c) => c.t === "after");
  if (after) rows = rows.filter(([p]) => p.split("/").pop() > after.id);
  const lim = q.cons.find((c) => c.t === "limit");
  return lim ? rows.slice(0, lim.n) : rows;
}
const build = (rows) => ({ docs: rows.map(([p, v]) => snapOf(p, v)), empty: !rows.length, size: rows.length });

export const getDoc = async (ref) => snapOf(ref.path, read(DB)[ref.path]);
export const getDocs = async (x) => build(run(norm(x)));
export function onSnapshot(x, cb) {
  const q = norm(x);
  let prev = new Set();
  const fire = () => {
    const rows = run(q), snap = build(rows), before = prev;
    snap.docChanges = () => rows.filter(([p]) => !before.has(p)).map(([p, v]) => ({ type: "added", doc: snapOf(p, v) }));
    prev = new Set(rows.map(([p]) => p));
    cb(snap);
  };
  listeners.add(fire);
  Promise.resolve().then(fire);
  return () => listeners.delete(fire);
}

function commit(ops) {
  const d = read(DB);
  for (const o of ops) {
    if (o.k === "set") d[o.p] = clone(o.v);
    else if (o.k === "update") {
      if (!(o.p in d)) throw err("not-found");
      d[o.p] = { ...d[o.p], ...clone(o.v) };
    } else delete d[o.p];
  }
  localStorage.setItem(DB, JSON.stringify(d));
  queueMicrotask(notify);
}
export const setDoc = async (ref, v) => commit([{ k: "set", p: ref.path, v }]);
export const deleteDoc = async (ref) => commit([{ k: "del", p: ref.path }]);
export const addDoc = async (col, v) => { const r = mk(`${col.path}/${uid()}`); commit([{ k: "set", p: r.path, v }]); return r; };
export const writeBatch = () => {
  const ops = [];
  const b = {
    set: (r, v) => (ops.push({ k: "set", p: r.path, v }), b),
    update: (r, v) => (ops.push({ k: "update", p: r.path, v }), b),
    delete: (r) => (ops.push({ k: "del", p: r.path }), b),
    commit: async () => commit(ops),
  };
  return b;
};
export async function runTransaction(_db, fn) {
  const ops = [];
  const tx = {
    get: async (r) => snapOf(r.path, read(DB)[r.path]),
    set: (r, v) => (ops.push({ k: "set", p: r.path, v }), tx),
    update: (r, v) => (ops.push({ k: "update", p: r.path, v }), tx),
    delete: (r) => (ops.push({ k: "del", p: r.path }), tx),
  };
  const out = await fn(tx);
  commit(ops);
  return out;
}

// بيانات أولية ليرى الزائر خدمة قابلة للحجز فورًا
if (localStorage.getItem(DB) === null) {
  localStorage.setItem(DB, JSON.stringify({
    "businesses/demo-business": {
      name: "صالون تجريبي", category: "صالون", phone: "+966500000000", city: "الرياض",
      workHours: { from: "09:00", to: "17:00" }, workDays: [0, 1, 2, 3, 4, 5, 6], daysOff: [],
      staff: [{ id: "main", name: "الجميع" }], autoConfirm: false, slug: "demo",
    },
    "slugs/demo": { uid: "demo-business" },
    "services/demo-service": {
      businessId: "demo-business", businessName: "صالون تجريبي", category: "صالون", city: "الرياض",
      name: "قص شعر", price: 50, duration: 30, desc: "خدمة تجريبية",
    },
  }));
}

if (!localStorage.getItem("waqti_demo_jobs_seed")) {
  const d = read(DB);
  if (!d["jobs/demo-job"])
    d["jobs/demo-job"] = {
      businessId: "demo-business", businessName: "صالون تجريبي", title: "مصفف شعر", city: "الرياض", type: "دوام كامل",
      minYears: 1, education: "ثانوي", salary: "4000", skills: ["قص الشعر", "صبغ", "تجميل", "خدمة العملاء"],
      description: "نبحث عن مصفف شعر محترف للانضمام إلى فريقنا.", active: true, createdAt: Date.now(),
    };
  localStorage.setItem(DB, JSON.stringify(d));
  localStorage.setItem("waqti_demo_jobs_seed", "1");
}

/* ---------------- Auth ---------------- */
const users = () => read(USERS);
const saveUsers = (u) => localStorage.setItem(USERS, JSON.stringify(u));
const mkUser = (r) => ({
  uid: r.uid, email: r.email || null, displayName: r.displayName || null, isAnonymous: !!r.anonymous,
  emailVerified: true, reload: async () => {}, getIdToken: async () => "demo",
});
export const auth = { currentUser: null };
const authListeners = new Set();
const setCurrent = (rec) => {
  auth.currentUser = rec ? mkUser(rec) : null;
  if (rec) localStorage.setItem(CUR, rec.uid); else localStorage.removeItem(CUR);
  authListeners.forEach((l) => l(auth.currentUser));
  return auth.currentUser;
};
{ const c = localStorage.getItem(CUR), r = c && users()[c]; if (r) auth.currentUser = mkUser(r); }

export const onAuthStateChanged = (_a, cb) => {
  authListeners.add(cb);
  setTimeout(() => cb(auth.currentUser), 0);
  return () => authListeners.delete(cb);
};
const byEmail = (email) => Object.values(users()).find((u) => u.email === email);
const addUser = (rec) => { const u = users(); u[rec.uid] = rec; saveUsers(u); return rec; };

export async function createUserWithEmailAndPassword(_a, email, password) {
  if (!/^\S+@\S+\.\S+$/.test(email)) throw err("auth/invalid-email");
  if (password.length < 6) throw err("auth/weak-password");
  if (byEmail(email)) throw err("auth/email-already-in-use");
  return { user: setCurrent(addUser({ uid: uid(), email, password })) };
}
export async function signInWithEmailAndPassword(_a, email, password) {
  const r = byEmail(email);
  if (!r || r.password !== password) throw err("auth/invalid-credential");
  return { user: setCurrent(r) };
}
export const signInAnonymously = async () => ({ user: setCurrent(addUser({ uid: uid(), anonymous: true })) });
export const signOut = async () => { setCurrent(null); };
export const sendEmailVerification = async () => {};

export class GoogleAuthProvider {}
export const EmailAuthProvider = { credential: (email, password) => ({ email, password }) };
const askGoogle = () => {
  const email = (prompt("وضع تجريبي: أدخل بريد Google للمحاكاة (مثل name@gmail.com)") || "").trim().toLowerCase();
  if (!email) throw err("auth/popup-closed-by-user");
  return email;
};
export async function signInWithPopup() {
  const email = askGoogle();
  const rec = byEmail(email) || addUser({ uid: uid(), email, displayName: email.split("@")[0] });
  return { user: setCurrent(rec) };
}
function upgrade(user, email, password) {
  const other = byEmail(email);
  if (other && other.uid !== user.uid) throw err("auth/email-already-in-use");
  const u = users(), rec = u[user.uid];
  Object.assign(rec, { email, anonymous: false }, password ? { password } : {});
  saveUsers(u);
  return { user: setCurrent(rec) };
}
export async function linkWithCredential(user, cred) {
  if (cred.password.length < 6) throw err("auth/weak-password");
  return upgrade(user, cred.email, cred.password);
}
export const linkWithPopup = async (user) => upgrade(user, askGoogle());
