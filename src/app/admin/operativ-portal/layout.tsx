import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SBR Fire App",
  description: "Operativ køretøjs-, rum- og udstyrsguide for Slagelse Brand og Redning",
  manifest: "/operativ-manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "SBR Fire App",
    statusBarStyle: "black-translucent"
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }]
  }
};

export default function OperationalPortalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
