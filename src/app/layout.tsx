import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { getLang } from "@/lib/lang";
import "./globals.css";

// One geometric family drawn for both Latin and Devanagari (Indian Type Foundry), so English, Marathi and Hindi
// read as one app. The Devanagari files only download when Devanagari text is on screen.
const poppins = Poppins({ subsets: ["latin", "devanagari"], weight: ["400", "500", "600", "700"], variable: "--font-poppins", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Township", template: "%s · Township" },
  description: "Maintenance bills, complaints, visitors and bookings for Company A Township.",
  applicationName: "Township",
  appleWebApp: { capable: true, title: "Township", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f2ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0c" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={`${lang}-IN`} className={poppins.variable}>
      <body className="min-h-dvh font-sans text-[15px] antialiased">{children}</body>
    </html>
  );
}
