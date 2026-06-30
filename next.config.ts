import type { NextConfig } from "next";

// Security response headers. CSP intentionally avoids script-src until inline
// theme/JSON-LD scripts can be nonce-backed without breaking first paint.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    value:
      "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
