import { Link } from "react-router-dom";

const Door = ({ href, title, text, cls }) => (
  <Link
    to={href}
    className={`flex flex-1 flex-col justify-end gap-3 p-8 transition hover:brightness-110 focus-visible:outline focus-visible:outline-4 focus-visible:-outline-offset-4 focus-visible:outline-coral md:p-14 ${cls}`}
  >
    <h2 className="text-3xl font-bold md:text-5xl">{title}</h2>
    <p className="max-w-sm text-lg opacity-90">{text}</p>
  </Link>
);

export default function Home() {
  return (
    <div className="flex min-h-[85vh] flex-col">
      <header className="flex items-center justify-between px-6 py-5">
        <span className="text-2xl font-bold text-teal">وقتي</span>
        <Link to="/services" className="text-sm text-teal">تصفح الخدمات بدون حساب</Link>
      </header>
      <div className="flex flex-1 flex-col md:flex-row">
        <Door href="/services" title="أبحث عن خدمة" text="تصفح الخدمات واحجز موعدك في ثوانٍ، بدون حساب." cls="min-h-[40vh] bg-white text-ink" />
        <Door href="/login?role=business" title="أقدّم خدمة" text="أضف خدماتك وساعات عملك، واستقبل الحجوزات في مكان واحد." cls="min-h-[40vh] bg-teal text-white" />
      </div>
    </div>
  );
}
