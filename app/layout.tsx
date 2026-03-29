import type { Metadata } from "next";
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
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
