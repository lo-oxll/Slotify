"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [, setVer] = useState(0);

  const load = useCallback(async (u) => {
    setUser(u);
    if (u) {
      const s = await getDoc(doc(db, "users", u.uid));
      setProfile(s.exists() ? s.data() : null);
    } else setProfile(null);
    setLoading(false);
    setVer((v) => v + 1);
  }, []);

  useEffect(() => onAuthStateChanged(auth, load), [load]);

  return (
    <Ctx.Provider value={{ user, profile, loading, refresh: () => load(auth.currentUser), logout: () => signOut(auth) }}>
      {children}
    </Ctx.Provider>
  );
}
