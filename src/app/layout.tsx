import type { Metadata } from "next";
import { SessionRefresher } from "@/components/SessionRefresher";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vagtoverdragelse",
  description: "Midlertidig overdragelse af brandmandsvagt",
  manifest: "/manifest.webmanifest"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="da">
      <body className="min-h-screen font-sans antialiased">
        <SessionRefresher />
        {children}
      </body>
    </html>
  );
}
