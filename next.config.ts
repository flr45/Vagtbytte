import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
    : [])
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...securityHeaders,
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
        ]
      },
      {
        source: "/admin/operativ-portal/:path*",
        headers: [
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "Pragma", value: "no-cache" }
        ]
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" }
        ]
      },
      {
        source: "/operativ-manifest.webmanifest",
        headers: [{ key: "Content-Type", value: "application/manifest+json" }]
      }
    ];
  }
};

export default nextConfig;
