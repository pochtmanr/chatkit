import "server-only";
import { SignJWT, jwtVerify, decodeProtectedHeader } from "jose";
import { getServiceClient } from "@/lib/supabase/server";
import { lookupInbox } from "@/lib/embed-auth";

const ALG = "HS256";
const ISS = "holylabs";
const TTL_MIN_SECONDS = 300;
const TTL_MAX_SECONDS = 3600;
const TTL_DEFAULT_SECONDS = 3600;
const SUB_MAX = 256;
const NAME_EMAIL_MAX = 320;
const EXTERNAL_REFS_JSON_MAX = 4096;

export type WidgetKind = "support" | "order" | "direct";

export type WidgetClaims = {
  iss: "holylabs";
  aud: string;
  sub: string;
  name?: string;
  email?: string;
  avatar_url?: string;
  allowed_kinds: WidgetKind[];
  external_refs?: Record<string, string[]>;
  iat: number;
  exp: number;
};

export type MintInput = {
  inboxId: string;
  businessId: string;
  sub: string;
  name?: string;
  email?: string;
  avatar_url?: string;
  allowed_kinds?: WidgetKind[];
  external_refs?: Record<string, string[]>;
  ttl_seconds?: number;
};

export type MintError =
  | { ok: false; code: "inbox_not_found" }
  | { ok: false; code: "business_inactive"; status: string }
  | { ok: false; code: "claim_too_large"; field: string };
export type MintSuccess = {
  ok: true;
  token: string;
  expires_at: string;
  sub_truncated_for_logging: string;
};
export type MintResult = MintSuccess | MintError;

export type VerifyError = { ok: false; reason: string };
export type VerifySuccess = {
  ok: true;
  claims: WidgetClaims;
  inboxId: string;
  businessId: string;
};
export type VerifyResult = VerifySuccess | VerifyError;

function clampTtl(ttl: number | undefined): number {
  const v = typeof ttl === "number" && Number.isFinite(ttl) ? ttl : TTL_DEFAULT_SECONDS;
  return Math.max(TTL_MIN_SECONDS, Math.min(TTL_MAX_SECONDS, Math.floor(v)));
}

/** Decode a Postgres bytea value returned by postgrest. Default Postgres
 *  output is `\x<hex>`; supabase-js surfaces it verbatim. We rebuild the
 *  raw byte buffer here. */
function decodeBytea(value: string): Uint8Array {
  if (value.startsWith("\\x")) {
    const hex = value.slice(2);
    const buf = new Uint8Array(hex.length / 2);
    for (let i = 0; i < buf.length; i += 1) {
      buf[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return buf;
  }
  // Older postgres builds may use `bytea_output = escape`; we don't ship
  // that combination, but the empty fallback keeps callers from crashing.
  return new TextEncoder().encode(value);
}

export async function signWidgetToken(input: MintInput): Promise<MintResult> {
  if (input.sub.length === 0 || input.sub.length > SUB_MAX) {
    return { ok: false, code: "claim_too_large", field: "sub" };
  }
  if (input.name && input.name.length > NAME_EMAIL_MAX) {
    return { ok: false, code: "claim_too_large", field: "name" };
  }
  if (input.email && input.email.length > NAME_EMAIL_MAX) {
    return { ok: false, code: "claim_too_large", field: "email" };
  }
  if (input.external_refs) {
    const size = JSON.stringify(input.external_refs).length;
    if (size > EXTERNAL_REFS_JSON_MAX) {
      return { ok: false, code: "claim_too_large", field: "external_refs" };
    }
  }

  const admin = getServiceClient();
  const { data: inbox } = await admin
    .from("inboxes")
    .select(
      "id, business_id, archived_at, widget_signing_secret, business:businesses(id, status)",
    )
    .eq("id", input.inboxId)
    .maybeSingle();
  if (!inbox || inbox.archived_at) {
    return { ok: false, code: "inbox_not_found" };
  }
  const biz = Array.isArray(inbox.business) ? inbox.business[0] : inbox.business;
  if (!biz || biz.status !== "active") {
    return { ok: false, code: "business_inactive", status: biz?.status ?? "unknown" };
  }

  const secret = decodeBytea(inbox.widget_signing_secret);
  const now = Math.floor(Date.now() / 1000);
  const exp = now + clampTtl(input.ttl_seconds);
  const allowedKinds: WidgetKind[] = input.allowed_kinds ?? ["support"];

  const payload: Record<string, unknown> = {
    allowed_kinds: allowedKinds,
  };
  if (input.name) payload.name = input.name;
  if (input.email) payload.email = input.email;
  if (input.avatar_url) payload.avatar_url = input.avatar_url;
  if (input.external_refs) payload.external_refs = input.external_refs;

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: ALG, kid: input.inboxId, typ: "JWT" })
    .setIssuer(ISS)
    .setAudience(input.inboxId)
    .setSubject(input.sub)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(secret);

  return {
    ok: true,
    token,
    expires_at: new Date(exp * 1000).toISOString(),
    sub_truncated_for_logging: input.sub.slice(0, 8),
  };
}

async function tryVerify(jwt: string, secretValue: string, inboxId: string) {
  const secret = decodeBytea(secretValue);
  return jwtVerify(jwt, secret, {
    algorithms: [ALG],
    issuer: ISS,
    audience: inboxId,
    clockTolerance: 60,
  });
}

export async function verifyWidgetToken(
  rawJwt: string,
  publishableKey: string,
): Promise<VerifyResult> {
  if (!rawJwt || !publishableKey) return { ok: false, reason: "missing token or pk" };

  let inbox;
  try {
    inbox = await lookupInbox(publishableKey);
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "pk lookup failed" };
  }
  if (inbox.businessStatus !== "active") {
    return { ok: false, reason: `business ${inbox.businessStatus}` };
  }

  let header;
  try {
    header = decodeProtectedHeader(rawJwt);
  } catch {
    return { ok: false, reason: "malformed jwt header" };
  }
  if (header.alg !== ALG) return { ok: false, reason: "wrong alg" };
  if (header.kid !== inbox.inboxId) return { ok: false, reason: "kid mismatch" };

  const admin = getServiceClient();
  const { data: keys } = await admin
    .from("inboxes")
    .select("widget_signing_secret, widget_signing_secret_previous")
    .eq("id", inbox.inboxId)
    .maybeSingle();
  if (!keys?.widget_signing_secret) {
    return { ok: false, reason: "inbox has no signing key" };
  }

  let payload;
  try {
    ({ payload } = await tryVerify(rawJwt, keys.widget_signing_secret, inbox.inboxId));
  } catch {
    if (!keys.widget_signing_secret_previous) {
      return { ok: false, reason: "signature mismatch" };
    }
    try {
      ({ payload } = await tryVerify(rawJwt, keys.widget_signing_secret_previous, inbox.inboxId));
    } catch {
      return { ok: false, reason: "signature mismatch (both keys)" };
    }
  }

  // jose enforces iss/aud/exp/iat via clockTolerance — but allowed_kinds
  // is a custom claim. Validate shape so handlers can rely on it.
  const allowed = payload.allowed_kinds;
  if (
    !Array.isArray(allowed)
    || allowed.length === 0
    || allowed.some((k) => k !== "support" && k !== "order" && k !== "direct")
  ) {
    return { ok: false, reason: "invalid allowed_kinds" };
  }

  const claims: WidgetClaims = {
    iss: ISS,
    aud: inbox.inboxId,
    sub: typeof payload.sub === "string" ? payload.sub : "",
    name: typeof payload.name === "string" ? payload.name : undefined,
    email: typeof payload.email === "string" ? payload.email : undefined,
    avatar_url: typeof payload.avatar_url === "string" ? payload.avatar_url : undefined,
    allowed_kinds: allowed as WidgetKind[],
    external_refs:
      payload.external_refs && typeof payload.external_refs === "object"
        ? (payload.external_refs as Record<string, string[]>)
        : undefined,
    iat: typeof payload.iat === "number" ? payload.iat : 0,
    exp: typeof payload.exp === "number" ? payload.exp : 0,
  };
  if (!claims.sub) return { ok: false, reason: "missing sub" };

  return { ok: true, claims, inboxId: inbox.inboxId, businessId: inbox.businessId };
}
