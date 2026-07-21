import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vagtoverdragelse",
  description: "Midlertidig overdragelse af brandmandsvagt"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="da">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
