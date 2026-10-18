"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import Header from "./Header";

export default function Guard({ role, children }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/login?role=${role}`);
    else if (profile && profile.role !== role) router.replace(profile.role === "business" ? "/business" : "/services");
  }, [loading, user, profile, role, router]);

  if (loading || !user || !profile || profile.role !== role)
    return <p className="p-10 text-center text-ink/60">جارٍ التحميل…</p>;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </>
  );
}
