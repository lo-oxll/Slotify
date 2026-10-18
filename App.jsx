import { Suspense, lazy } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth";
import ClientInit from "./ClientInit";
import ErrorBoundary from "./ErrorBoundary";
const Home = lazy(() => import("./Home"));
const Login = lazy(() => import("./Login"));
const Business = lazy(() => import("./Business"));
const Services = lazy(() => import("./Services"));
const Book = lazy(() => import("./Book"));
const Bookings = lazy(() => import("./Bookings"));
const BusinessPage = lazy(() => import("./BusinessPage"));
const Terms = lazy(() => import("./Terms"));
const Privacy = lazy(() => import("./Privacy"));

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Suspense fallback={<p className="p-10 text-center text-ink/60">جارٍ التحميل…</p>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/business" element={<Business />} />
          <Route path="/services" element={<Services />} />
          <Route path="/book" element={<Book />} />
          <Route path="/bookings" element={<Bookings />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/:slug" element={<BusinessPage />} />
        </Routes>
        </Suspense>
        <ClientInit />
        <footer className="mx-auto flex max-w-4xl gap-4 px-4 py-8 text-sm text-ink/60">
          <Link to="/terms">شروط الاستخدام</Link>
          <Link to="/privacy">سياسة الخصوصية</Link>
        </footer>
      </AuthProvider>
    </ErrorBoundary>
  );
}
