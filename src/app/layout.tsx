import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Devanagari } from "next/font/google";
import { getLang } from "@/lib/lang";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const deva = Noto_Sans_Devanagari({ subsets: ["devanagari"], variable: "--font-deva", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Township", template: "%s · Township" },
  description: "Maintenance bills, complaints, visitors and bookings for Company A Township.",
  applicationName: "Township",
  appleWebApp: { capable: true, title: "Township", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#0f766e", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={`${lang}-IN`} className={`${inter.variable} ${deva.variable}`}>
      <body className="min-h-dvh bg-stone-50 font-sans text-zinc-900 antialiased">{children}</body>
    </html>
  );
}
