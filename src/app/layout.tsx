import type { Metadata, Viewport } from "next";
import { Mukta } from "next/font/google";
import { getLang } from "@/lib/lang";
import "./globals.css";

// One family drawn for both Latin and Devanagari (Ek Type, Mumbai), so English, Marathi and Hindi read as one app.
// The Devanagari file only downloads when Devanagari text is on screen.
const mukta = Mukta({ subsets: ["latin", "devanagari"], weight: ["400", "500", "600", "700"], variable: "--font-mukta", display: "swap" });

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
    { media: "(prefers-color-scheme: light)", color: "#f5f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0c100f" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={`${lang}-IN`} className={mukta.variable}>
      <body className="min-h-dvh font-sans text-[16px] antialiased">{children}</body>
    </html>
  );
}
