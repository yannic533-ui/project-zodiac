import type { Metadata } from "next";
import { I18nProvider } from "@/lib/i18n/locale-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "Schnuffis — Bar scavenger hunts",
  description: "Multi-tenant scavenger hunt platform for bars and live Telegram games",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="min-h-screen antialiased">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
