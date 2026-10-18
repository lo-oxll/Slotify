"use client";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

export default function Header() {
  const { user, profile, logout } = useAuth();
  const role = profile?.role;
  const links =
    role === "business" ? [["/business", "لوحة النشاط"]]
    : role === "client" ? [["/services", "الخدمات"], ["/bookings", "حجوزاتي"]]
    : [["/services", "الخدمات"], ["/login?role=client", "دخول العملاء"], ["/login?role=business", "للأنشطة"]];
  const out = () => {
    if (user?.isAnonymous && !confirm("سيفقد هذا الجهاز الوصول إلى حجوزاتك إن لم تنشئ حسابًا. هل تريد الخروج؟")) return;
    logout();
  };
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="text-xl font-bold text-teal">وقتي</Link>
        <nav className="flex flex-wrap items-center gap-4 text-sm">
          {links.map(([href, label]) => <Link key={href} href={href} className="hover:text-teal">{label}</Link>)}
          {user && <button onClick={out} className="btn-alt">خروج</button>}
        </nav>
      </div>
    </header>
  );
}
