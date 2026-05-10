/**
 * HubSpot API helpers.
 *
 * All functions here are server-only — they read tenant tokens from the
 * database and call HubSpot directly. Never expose to the browser.
 *
 * Token lifecycle: access tokens last 30 minutes; refresh tokens are
 * long-lived. `getValidAccessToken` transparently refreshes on demand
 * and writes the new pair back to the tenant row.
 */

import { getServiceClient } from "@/lib/supabase/server";
import { createHmac, timingSafeEqual } from "node:crypto";

const HUBSPOT_API = "https://api.hubapi.com";
const HUBSPOT_OAUTH = "https://api.hubapi.com/oauth/v1/token";

export interface TenantHubSpotState {
  id: string;
  hubspot_access_token: string | null;
  hubspot_refresh_token: string | null;
  hubspot_token_expires_at: string | null;
  hubspot_portal_id: string | null;
  hubspot_inbox_id: string | null;
  hubspot_webhook_secret: string | null;
}

/** A Private App access token from HubSpot's UI looks like
 *  `<region>-<uuid-without-dashes-grouped>` and never expires. Detect that
 *  format so we skip the refresh dance — Private Apps don't have refresh
 *  tokens or short-lived access tokens at all. */
function isPrivateAppToken(token: string | null | undefined): boolean {
  if (!token) return false;
  return /^(na|na2|eu|eu1|ap|au)\d?-[a-f0-9-]+$/i.test(token);
}

/** Returns a valid access token for the tenant, refreshing it first if
 *  it's within 60s of expiry. Throws if the tenant has never connected
 *  HubSpot or the refresh fails.
 *
 *  Private App tokens (set manually instead of via OAuth) are returned
 *  as-is — they don't expire and have no refresh token. */
export async function getValidAccessToken(tenantId: string): Promise<string> {
  const service = getServiceClient();
  const { data: tenant, error } = await service
    .from("tenants")
    .select(
      "id, hubspot_access_token, hubspot_refresh_token, hubspot_token_expires_at",
    )
    .eq("id", tenantId)
    .single();
  if (error || !tenant) throw new Error(`tenant ${tenantId} not found`);

  // Private App fast-path: no refresh, ever.
  if (isPrivateAppToken(tenant.hubspot_access_token)) {
    return tenant.hubspot_access_token!;
  }

  if (!tenant.hubspot_refresh_token) {
    throw new Error(`tenant ${tenantId} has not connected HubSpot`);
  }

  const expiresAt = tenant.hubspot_token_expires_at
    ? new Date(tenant.hubspot_token_expires_at).getTime()
    : 0;
  const now = Date.now();
  // 60s grace window so we don't hand out a token about to expire mid-request.
  if (tenant.hubspot_access_token && expiresAt - now > 60_000) {
    return tenant.hubspot_access_token;
  }

  const refreshed = await refreshAccessToken(tenant.hubspot_refresh_token);
  await service
    .from("tenants")
    .update({
      hubspot_access_token: refreshed.access_token,
      hubspot_refresh_token: refreshed.refresh_token,
      hubspot_token_expires_at: new Date(
        Date.now() + refreshed.expires_in * 1000,
      ).toISOString(),
    })
    .eq("id", tenant.id);
  return refreshed.access_token;
}

interface OAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
}

async function refreshAccessToken(refreshToken: string): Promise<OAuthTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: requireEnv("HUBSPOT_CLIENT_ID"),
    client_secret: requireEnv("HUBSPOT_CLIENT_SECRET"),
    refresh_token: refreshToken,
  });
  const res = await fetch(HUBSPOT_OAUTH, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HubSpot refresh failed (${res.status}): ${txt}`);
  }
  return res.json() as Promise<OAuthTokenResponse>;
}

/** Exchange the auth code from the OAuth redirect for a token pair.
 *  Called once per tenant from /api/hubspot/oauth/callback. */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<OAuthTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: requireEnv("HUBSPOT_CLIENT_ID"),
    client_secret: requireEnv("HUBSPOT_CLIENT_SECRET"),
    redirect_uri: redirectUri,
    code,
  });
  const res = await fetch(HUBSPOT_OAUTH, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HubSpot code exchange failed (${res.status}): ${txt}`);
  }
  return res.json() as Promise<OAuthTokenResponse>;
}

/** Get HubSpot account/portal id for a fresh token. We need this to
 *  build deep-links and to identify which account the tenant connected. */
export async function getPortalInfo(accessToken: string): Promise<{
  portal_id: number;
  user_id: number;
  hub_domain: string;
}> {
  const res = await fetch(
    `${HUBSPOT_API}/oauth/v1/access-tokens/${encodeURIComponent(accessToken)}`,
  );
  if (!res.ok) throw new Error(`portal info fetch failed: ${res.status}`);
  return res.json();
}

/** Send a chat message into HubSpot. If the conversation hasn't been
 *  bridged yet, this also creates the HubSpot thread and writes the
 *  mapping row.
 *
 *  Returns the HubSpot thread id so the caller can store it on the
 *  conversation record. */
export async function sendMessageToHubSpot(args: {
  tenantId: string;
  conversationId: string;
  /** Text body of the chat message. */
  message: string;
  /** End-user identity. HubSpot needs an email or a deliveryIdentifier
   *  to attribute the message to a contact. */
  fromUser: { email?: string; name?: string };
}): Promise<{ threadId: string }> {
  const service = getServiceClient();

  const { data: link } = await service
    .from("conversation_hubspot_links")
    .select("hubspot_thread_id")
    .eq("tenant_id", args.tenantId)
    .eq("conversation_id", args.conversationId)
    .maybeSingle();

  const accessToken = await getValidAccessToken(args.tenantId);

  if (link) {
    await postToThread(accessToken, link.hubspot_thread_id, args.message);
    return { threadId: link.hubspot_thread_id };
  }

  // First time we're bridging this conversation — create a thread.
  const { data: tenant } = await service
    .from("tenants")
    .select("hubspot_inbox_id")
    .eq("id", args.tenantId)
    .single();
  if (!tenant?.hubspot_inbox_id) {
    throw new Error("tenant has no HubSpot inbox configured");
  }

  const thread = await createThread(accessToken, {
    inboxId: tenant.hubspot_inbox_id,
    subject: `Chat from ${args.fromUser.name ?? args.fromUser.email ?? "user"}`,
    fromEmail: args.fromUser.email,
    message: args.message,
  });

  await service.from("conversation_hubspot_links").insert({
    tenant_id: args.tenantId,
    conversation_id: args.conversationId,
    hubspot_thread_id: thread.id,
  });
  return { threadId: thread.id };
}

async function postToThread(accessToken: string, threadId: string, text: string) {
  const res = await fetch(
    `${HUBSPOT_API}/conversations/v3/conversations/threads/${encodeURIComponent(threadId)}/messages`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "MESSAGE",
        text,
        senderActorId: "V-app", // visitor
      }),
    },
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HubSpot post-message failed (${res.status}): ${txt}`);
  }
}

async function createThread(
  accessToken: string,
  args: {
    inboxId: string;
    subject: string;
    fromEmail?: string;
    message: string;
  },
): Promise<{ id: string }> {
  const res = await fetch(`${HUBSPOT_API}/conversations/v3/conversations/threads`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      inboxId: args.inboxId,
      subject: args.subject,
      visitor: args.fromEmail
        ? { email: args.fromEmail }
        : { deliveryIdentifier: { type: "VISITOR_ID", value: "anonymous" } },
      messages: [{ type: "MESSAGE", text: args.message }],
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HubSpot create-thread failed (${res.status}): ${txt}`);
  }
  return res.json();
}

/** Verify that an inbound webhook came from HubSpot. HubSpot signs each
 *  request with HMAC-SHA256 over `method + uri + body + timestamp` keyed
 *  on the app's client secret.
 *
 *  Reference: https://developers.hubspot.com/docs/api/webhooks/validating-requests
 */
export function verifyHubSpotSignature(args: {
  method: string;
  /** Full URL the request was sent to, including query string. */
  url: string;
  body: string;
  timestamp: string;
  signature: string;
}): boolean {
  const clientSecret = requireEnv("HUBSPOT_CLIENT_SECRET");
  // 5-minute replay window — HubSpot's recommendation.
  const drift = Math.abs(Date.now() - Number(args.timestamp));
  if (Number.isNaN(drift) || drift > 5 * 60 * 1000) return false;

  const source = args.method + args.url + args.body + args.timestamp;
  const expected = createHmac("sha256", clientSecret).update(source).digest("base64");
  // timingSafeEqual requires equal-length buffers.
  const a = Buffer.from(expected);
  const b = Buffer.from(args.signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env var: ${name}`);
  return v;
}
