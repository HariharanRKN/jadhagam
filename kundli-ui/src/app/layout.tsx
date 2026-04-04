import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kundli — South Indian Rasi",
  description: "South Indian astrology chart (Rasi) — React + CSS Grid",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
