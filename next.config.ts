import type { NextConfig } from "next";

/** Hosts allowed to iframe chat-admin's /embed/* routes.
 *
 *  Fully driven by EMBED_ALLOWED_ORIGINS — comma-separated list.
 *  Read at build time, so a Vercel env var change requires a fresh
 *  deployment (not just a redeploy of the existing build) to take
 *  effect. Example:
 *    EMBED_ALLOWED_ORIGINS="https://greenflagged.xyz,http://localhost:3000"
 */
function embedAllowedOrigins(): string[] {
  const envList = process.env.EMBED_ALLOWED_ORIGINS;
  if (!envList) return [];
  return Array.from(
    new Set(envList.split(",").map((s) => s.trim()).filter(Boolean)),
  );
}

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Friendly URL: /api → /api-reference. Note we only match the exact
      // path; /api/* still resolves to the route handlers under src/app/api.
      { source: "/api", destination: "/api-reference", permanent: false },
    ];
  },
  async headers() {
    const allowed = embedAllowedOrigins();
    // CSP frame-ancestors is the modern replacement for X-Frame-Options.
    // Browsers honor frame-ancestors when it's present.
    const frameAncestors = ["'self'", ...allowed].join(" ");
    return [
      {
        // Lock down every route by default — anything not under /embed
        // cannot be iframed at all. Belt-and-suspenders with X-Frame-Options
        // for older browsers / proxies that strip CSP.
        source: "/((?!embed).*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
      {
        // /embed/* can be framed by the allowlist.
        source: "/embed/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${frameAncestors}`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
