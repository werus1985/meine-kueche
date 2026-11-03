import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Erlaubt den Zugriff auf Dev-Ressourcen (HMR, Client-Bundles) über die
  // LAN-IP und 127.0.0.1, z. B. beim Testen auf dem iPhone.
  allowedDevOrigins: ["127.0.0.1", "192.168.178.27", "localhost"],
  experimental: {
    serverActions: {
      // Produktfotos werden über Server Actions hochgeladen.
      bodySizeLimit: "6mb",
    },
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
