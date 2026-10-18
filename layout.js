import "./globals.css";
import Link from "next/link";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import ClientInit from "@/components/ClientInit";

const font = IBM_Plex_Sans_Arabic({ subsets: ["arabic", "latin"], weight: ["400", "500", "700"] });

export const metadata = { title: "وقتي", description: "احجز موعدك عند أي نشاط بدون اتصال", icons: { icon: "/icon.svg", apple: "/icon-192.png" } };
export const viewport = { themeColor: "#0E7C7B" };

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${font.className} min-h-screen bg-paper text-ink`}>
        <AuthProvider>
          {children}
          <ClientInit />
          <footer className="mx-auto flex max-w-4xl gap-4 px-4 py-8 text-sm text-ink/60">
            <Link href="/terms">شروط الاستخدام</Link>
            <Link href="/privacy">سياسة الخصوصية</Link>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
