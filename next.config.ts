import type { NextConfig } from "next";

/** Hosts allowed to iframe chat-admin's /embed/* routes.
 *
 *  Env var override lets you add staging or local dev hosts without
 *  editing code. Comma-separated list, e.g.
 *    EMBED_ALLOWED_ORIGINS="https://staging.isrshipping.com,http://localhost:3000"
 */
function embedAllowedOrigins(): string[] {
  const envList = process.env.EMBED_ALLOWED_ORIGINS;
  const fromEnv = envList
    ? envList
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  // Default + env additions, deduped.
  return Array.from(
    new Set([
      "https://www.isrshipping.com",
      "https://isrshipping.com",
      ...fromEnv,
    ]),
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
