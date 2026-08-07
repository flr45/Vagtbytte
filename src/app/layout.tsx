import type { Metadata, Viewport } from "next";
import { SessionRefresher } from "@/components/SessionRefresher";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import "./globals.css";

export const metadata: Metadata = {
  title: "SBR Fire App",
  description: "Alarm, vagter og operativ viden samlet for Slagelse Brand og Redning",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "SBR Fire",
    statusBarStyle: "black-translucent"
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#b70f18"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="da">
      <body className="min-h-screen font-sans antialiased">
        <ServiceWorkerRegistrar />
        <SessionRefresher />
        {children}
      </body>
    </html>
  );
}
