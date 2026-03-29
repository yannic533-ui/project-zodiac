import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { I18nProvider } from "@/lib/i18n/locale-context";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "500"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Schnuffis — Bar scavenger hunts",
  description: "Multi-tenant scavenger hunt platform for bars and live Telegram games",
};

export const viewport = {
  width: "device-width" as const,
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={inter.variable}>
      <body
        className={`min-h-screen antialiased font-sans ${inter.className}`}
        style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}
      >
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
