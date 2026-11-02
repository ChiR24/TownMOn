import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // PGlite (embedded Postgres for local runs) loads its own WASM, so keep it out of the bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Bank statements and photos arrive through server actions; a month's statement is well under this.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
