/**
 * Embed token authentication.
 *
 * GoDelivery admin (or any other host that wants to iframe chat-admin's
 * inbox) signs a short-lived JWT with a shared secret. chat-admin
 * verifies the JWT and treats the bearer as an authorized agent for
 * the named tenant.
 *
 * Token format (standard JWT, HS256):
 *   header:    { "alg": "HS256", "typ": "JWT" }
 *   payload:   {
 *     "iss": "<host-name>",       // identifies the host that signed it
 *     "tid": "<tenant_uuid>",      // chat-admin tenant id this agent acts on
 *     "uid": "<host-admin-id>",    // host's own admin user id (free-form)
 *     "name"?: "<display name>",   // optional, shown in the UI
 *     "iat": <unix>,
 *     "exp": <unix>                // required; we reject if > 24h in future
 *   }
 *   signature: HMAC-SHA256(base64url(header) + '.' + base64url(payload), SECRET)
 *
 * Shared secret lives in env var EMBED_JWT_SECRET. Same value must be
 * configured on the host that signs tokens. Rotate by setting a new
 * value on both ends.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export interface EmbedTokenPayload {
  iss: string;
  tid: string;
  uid: string;
  name?: string;
  iat?: number;
  exp: number;
}

export interface EmbedSession {
  tenantId: string;
  adminUid: string;
  adminName: string;
  issuer: string;
  expiresAt: Date;
}

class EmbedAuthError extends Error {
  constructor(public reason: string) {
    super(`embed auth failed: ${reason}`);
    this.name = "EmbedAuthError";
  }
}

function base64urlDecode(s: string): Buffer {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, "base64");
}

/** Verify a JWT-format embed token. Returns the parsed session on
 *  success; throws EmbedAuthError on any failure. Reasons are
 *  intentionally generic in the error message (we don't leak signature
 *  vs. format vs. expiry to the caller). */
export function verifyEmbedToken(token: string): EmbedSession {
  const secret = process.env.EMBED_JWT_SECRET;
  if (!secret) {
    throw new EmbedAuthError("server: EMBED_JWT_SECRET not configured");
  }

  const parts = token.split(".");
  if (parts.length !== 3) throw new EmbedAuthError("malformed token");

  const [headerB64, payloadB64, sigB64] = parts;

  // Verify signature first — constant-time compare so we don't leak via
  // timing whether the header/payload parse succeeded.
  const signingInput = `${headerB64}.${payloadB64}`;
  const expected = createHmac("sha256", secret).update(signingInput).digest();
  const provided = base64urlDecode(sigB64);
  if (expected.length !== provided.length) throw new EmbedAuthError("bad sig");
  if (!timingSafeEqual(expected, provided)) throw new EmbedAuthError("bad sig");

  let header: { alg?: string; typ?: string };
  let payload: EmbedTokenPayload;
  try {
    header = JSON.parse(base64urlDecode(headerB64).toString("utf8"));
    payload = JSON.parse(base64urlDecode(payloadB64).toString("utf8"));
  } catch {
    throw new EmbedAuthError("bad json");
  }
  if (header.alg !== "HS256") throw new EmbedAuthError("bad alg");

  if (typeof payload.exp !== "number") throw new EmbedAuthError("missing exp");
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) throw new EmbedAuthError("expired");
  // Refuse tokens with absurd expirations — bounds the blast radius if
  // the host accidentally signs a long-lived token.
  if (payload.exp > now + 24 * 60 * 60) {
    throw new EmbedAuthError("exp too far in future");
  }

  if (!payload.tid || !payload.uid || !payload.iss) {
    throw new EmbedAuthError("missing claims");
  }

  return {
    tenantId: payload.tid,
    adminUid: payload.uid,
    adminName: payload.name ?? payload.uid,
    issuer: payload.iss,
    expiresAt: new Date(payload.exp * 1000),
  };
}
