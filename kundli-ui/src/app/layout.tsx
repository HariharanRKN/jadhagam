import type { Metadata } from "next";
import { DocumentTitle } from "@/components/DocumentTitle";
import { LanguageProvider } from "@/components/LanguageProvider";
import { LanguageToggle } from "@/components/LanguageToggle";
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
    <html lang="en" suppressHydrationWarning>
      <body>
        <LanguageProvider>
          <DocumentTitle />
          <div className="appShell">
            <div className="appTopbar">
              <LanguageToggle />
            </div>
            {children}
          </div>
        </LanguageProvider>
      </body>
    </html>
  );
}
