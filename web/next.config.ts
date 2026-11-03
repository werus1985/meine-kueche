import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Supabase-URL zur Build-Zeit (CSP muss sie erlauben). Ohne Env bleibt der
// lokale Dev-Endpunkt.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const supabaseWs = supabaseUrl.replace(/^http/, "ws");

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js injiziert Inline-Skripte für die Hydration; im Dev-Modus kommt
  // Turbopack mit eval dazu.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // Produktfoto-Vorschau aus Open Food Facts (vor dem Import).
  "img-src 'self' data: blob: https://*.openfoodfacts.org https://*.openfoodfacts.net",
  "font-src 'self'",
  `connect-src 'self' ${supabaseUrl} ${supabaseWs}${isDev ? " ws: http: https:" : ""}`,
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // HSTS nur in Produktion – im Dev-Betrieb mit selbstsigniertem Zertifikat
  // wäre eine Sperre kontraproduktiv.
  ...(isDev
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Erlaubt den Zugriff auf Dev-Ressourcen (HMR, Client-Bundles) über die
  // LAN-IP und 127.0.0.1, z. B. beim Testen auf dem iPhone.
  allowedDevOrigins: ["127.0.0.1", "192.168.178.27", "localhost"],
  experimental: {
    serverActions: {
      // Fotos werden auf 4 MB begrenzt (Vercel-Limit für Request-Bodies: 4,5 MB).
      bodySizeLimit: "5mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
