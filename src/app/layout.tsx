import type { Metadata } from "next";
import { SessionRefresher } from "@/components/SessionRefresher";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vagtoverdragelse",
  description: "Midlertidig overdragelse af brandmandsvagt",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Vagtbytte",
    statusBarStyle: "default"
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }]
  }
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
