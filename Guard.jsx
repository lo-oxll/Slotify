import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./auth";
import Header from "./Header";

export default function Guard({ role, children }) {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate(`/login?role=${role}`, { replace: true });
    else if (profile && profile.role !== role) navigate(profile.role === "business" ? "/business" : "/services", { replace: true });
  }, [loading, user, profile, role, navigate]);

  if (loading || !user || !profile || profile.role !== role)
    return <p className="p-10 text-center text-ink/60">جارٍ التحميل…</p>;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </>
  );
}
