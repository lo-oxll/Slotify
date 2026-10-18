// يختار الواجهة الخلفية تلقائيًا: Firebase الحقيقي إن وُجدت الإعدادات في config.js، وإلا الوضع التجريبي المحلي
import { firebaseConfig } from "./config.js";

export const isDemo = !(firebaseConfig.apiKey && firebaseConfig.projectId);
const m = await import(isDemo ? "./fb-local.js" : "./fb-real.js");

export const {
  EmailAuthProvider,
  GoogleAuthProvider,
  addDoc,
  auth,
  collection,
  createUserWithEmailAndPassword,
  db,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  onSnapshot,
  query,
  runTransaction,
  sendEmailVerification,
  serverTimestamp,
  setDoc,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  startAfter,
  where,
  writeBatch
} = m;
