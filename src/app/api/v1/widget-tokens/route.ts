import { NextResponse, type NextRequest } from "next/server";
import { lookupServerSecret } from "@/lib/server-secret";
import { signWidgetToken, type WidgetKind } from "@/lib/widget-token";
import { createHash } from "node:crypto";

const ALLOWED_KINDS = new Set<WidgetKind>(["support", "order", "direct"]);
const USER_ID_MAX = 256;
const EXT_REF_VALUE_MAX = 128;
const EXT_REF_VALUES_PER_KEY_MAX = 32;

type ParsedBody = {
  user_id: string;
  name?: string;
  email?: string;
  avatar_url?: string;
  allowed_kinds: WidgetKind[];
  external_refs?: Record<string, string[]>;
  ttl_seconds?: number;
};

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function parseBody(raw: unknown): ParsedBody | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "invalid payload" };
  const body = raw as Record<string, unknown>;

  const userId = body.user_id;
  if (typeof userId !== "string" || userId.length === 0 || userId.length > USER_ID_MAX) {
    return { error: "user_id must be a non-empty string ≤ 256 chars" };
  }
  if (/\s/.test(userId)) return { error: "user_id must not contain whitespace" };

  const kindsInput = body.allowed_kinds ?? ["support"];
  if (!Array.isArray(kindsInput) || kindsInput.length === 0) {
    return { error: "allowed_kinds must be a non-empty array" };
  }
  const kinds: WidgetKind[] = [];
  for (const k of kindsInput) {
    if (typeof k !== "string" || !ALLOWED_KINDS.has(k as WidgetKind)) {
      return { error: `invalid allowed_kinds entry: ${String(k)}` };
    }
    kinds.push(k as WidgetKind);
  }

  let externalRefs: Record<string, string[]> | undefined;
  if (body.external_refs !== undefined) {
    if (typeof body.external_refs !== "object" || body.external_refs === null) {
      return { error: "external_refs must be an object" };
    }
    externalRefs = {};
    for (const [key, values] of Object.entries(body.external_refs)) {
      if (!kinds.includes(key as WidgetKind)) {
        return { error: `external_refs key "${key}" not in allowed_kinds` };
      }
      if (!Array.isArray(values) || values.length === 0 || values.length > EXT_REF_VALUES_PER_KEY_MAX) {
        return { error: `external_refs.${key} must be a non-empty array ≤ ${EXT_REF_VALUES_PER_KEY_MAX} entries` };
      }
      for (const v of values) {
        if (typeof v !== "string" || v.length === 0 || v.length > EXT_REF_VALUE_MAX) {
          return { error: `external_refs.${key} entries must be 1..${EXT_REF_VALUE_MAX}-char strings` };
        }
      }
      externalRefs[key] = values as string[];
    }
  }

  const result: ParsedBody = { user_id: userId, allowed_kinds: kinds };
  if (typeof body.name === "string") result.name = body.name;
  if (typeof body.email === "string") result.email = body.email;
  if (typeof body.avatar_url === "string") result.avatar_url = body.avatar_url;
  if (externalRefs) result.external_refs = externalRefs;
  if (typeof body.ttl_seconds === "number") result.ttl_seconds = body.ttl_seconds;
  return result;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  if (!match) {
    return NextResponse.json({ error: "missing bearer token" }, { status: 401 });
  }
  const sk = match[1].trim();
  if (!sk.startsWith("sk_live_")) {
    return NextResponse.json({ error: "invalid server secret" }, { status: 401 });
  }

  const inbox = await lookupServerSecret(sk);
  if (!inbox) {
    return NextResponse.json({ error: "invalid server secret" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return bad("invalid json");
  }
  const parsed = parseBody(raw);
  if ("error" in parsed) return bad(parsed.error);

  const minted = await signWidgetToken({
    inboxId: inbox.inboxId,
    businessId: inbox.businessId,
    sub: parsed.user_id,
    name: parsed.name,
    email: parsed.email,
    avatar_url: parsed.avatar_url,
    allowed_kinds: parsed.allowed_kinds,
    external_refs: parsed.external_refs,
    ttl_seconds: parsed.ttl_seconds,
  });

  if (!minted.ok) {
    if (minted.code === "business_inactive") {
      return NextResponse.json(
        { error: `business is ${minted.status}` },
        { status: 403 },
      );
    }
    if (minted.code === "inbox_not_found") {
      return NextResponse.json({ error: "invalid server secret" }, { status: 401 });
    }
    return bad(`${minted.field} too large`);
  }

  // Log correlation hash on the way out so future verify-side logs can
  // be matched back to mints without storing raw tokens.
  const tail = minted.token.slice(-16);
  const tokenFingerprint = createHash("sha256").update(tail).digest("hex").slice(0, 16);
  console.log(
    "[widget-tokens] minted",
    JSON.stringify({
      inboxId: inbox.inboxId,
      sub: minted.sub_truncated_for_logging,
      token_fp: tokenFingerprint,
    }),
  );

  return NextResponse.json({
    token: minted.token,
    token_type: "Bearer",
    expires_at: minted.expires_at,
  });
}

// Negative cases verified manually (curl examples in
// prompts/round-5/1-keys-and-tokens.md §7):
//   1. missing Authorization header → 401 "missing bearer token"
//   2. pk_live_... as Bearer → 401 "invalid server secret"
//   3. unknown sk_live_ → 401 "invalid server secret"
//   4. business suspended → 403 "business is suspended"
//   5. user_id "" / whitespace / > 256 chars → 400
//   6. allowed_kinds contains "agent" → 400
