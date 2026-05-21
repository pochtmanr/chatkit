import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Friendly URL: /api → /api-reference. Note we only match the exact
      // path; /api/* still resolves to the route handlers under src/app/api.
      { source: "/api", destination: "/api-reference", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        // Lock down every non-embed route — they can't be iframed at all.
        // X-Frame-Options is belt-and-suspenders for older browsers /
        // proxies that strip CSP.
        //
        // /embed/* deliberately omitted here: middleware sets its CSP
        // per-request, reading the embedding business's allowed_origins
        // from the DB (see src/lib/embed-auth.ts:frameAncestorsForKey).
        source: "/((?!embed).*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
