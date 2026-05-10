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
 *  build deep-links and to identify which account the tenant connected.
 *
 *  Note: HubSpot's UI calls this "Portal ID" but the API field is
 *  `hub_id`. We translate at the boundary so callers see the friendlier
 *  name. */
export async function getPortalInfo(accessToken: string): Promise<{
  portal_id: number;
  user_id: number;
  hub_domain: string;
}> {
  const res = await fetch(
    `${HUBSPOT_API}/oauth/v1/access-tokens/${encodeURIComponent(accessToken)}`,
  );
  if (!res.ok) throw new Error(`portal info fetch failed: ${res.status}`);
  const raw = (await res.json()) as {
    hub_id?: number;
    user_id?: number;
    hub_domain?: string;
  };
  return {
    portal_id: raw.hub_id ?? 0,
    user_id: raw.user_id ?? 0,
    hub_domain: raw.hub_domain ?? "",
  };
}

/** Bridge a chat message into HubSpot.
 *
 *  Strategy: each chat conversation maps to one HubSpot ticket. The
 *  first message creates the ticket; every subsequent message gets
 *  attached as a `Note` engagement on that same ticket so the support
 *  rep sees a chronological log inside the ticket view.
 *
 *  Why tickets instead of Conversations Inbox: HubSpot's Conversations
 *  API doesn't allow programmatic thread creation — threads are owned
 *  by Channels (Live Chat, Email, etc.) which won't accept arbitrary
 *  external messages without a Custom Channel Connector setup. Tickets
 *  are first-class CRM objects with full create/append support on
 *  every paid HubSpot tier, so this is the path that actually works.
 *
 *  Returns the HubSpot ticket id. */
export async function sendMessageToHubSpot(args: {
  tenantId: string;
  conversationId: string;
  /** Text body of the chat message. */
  message: string;
  /** End-user identity. Used in the ticket subject and to associate
   *  with a HubSpot contact when an email is present. */
  fromUser: { email?: string; name?: string };
}): Promise<{ ticketId: string }> {
  const service = getServiceClient();
  const accessToken = await getValidAccessToken(args.tenantId);

  // Already bridged? Append as a note.
  const { data: link } = await service
    .from("conversation_hubspot_links")
    .select("hubspot_ticket_id")
    .eq("tenant_id", args.tenantId)
    .eq("conversation_id", args.conversationId)
    .maybeSingle();
  if (link?.hubspot_ticket_id) {
    await appendNoteToTicket(accessToken, link.hubspot_ticket_id, args);
    return { ticketId: link.hubspot_ticket_id };
  }

  // First message in this conversation — create a ticket.
  const ticket = await createTicket(accessToken, args);
  const { error: linkErr } = await service
    .from("conversation_hubspot_links")
    .insert({
      tenant_id: args.tenantId,
      conversation_id: args.conversationId,
      hubspot_ticket_id: ticket.id,
    });
  // If the link insert fails (e.g. migration 0003 not applied so
  // hubspot_thread_id is still NOT NULL), surface it so the caller
  // sees a real error instead of getting duplicate tickets on retry.
  if (linkErr) {
    throw new Error(
      `created HubSpot ticket ${ticket.id} but failed to write link row: ${linkErr.message}`,
    );
  }
  return { ticketId: ticket.id };
}

async function createTicket(
  accessToken: string,
  args: {
    message: string;
    fromUser: { email?: string; name?: string };
  },
): Promise<{ id: string }> {
  const subjectName = args.fromUser.name ?? args.fromUser.email ?? "user";
  const res = await fetch(`${HUBSPOT_API}/crm/v3/objects/tickets`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        subject: `Chat from ${subjectName}`,
        // HubSpot stores the initial message in `content`; subsequent
        // messages go in as separate Note engagements.
        content: prefixMessage(args.message, args.fromUser),
        // Required-ish: every ticket needs to land in a pipeline+stage.
        // "0" is the default Support Pipeline, "1" is its first stage
        // ("New") on every fresh HubSpot account. If the tenant has
        // customized their pipelines we may need to surface this in
        // settings, but defaults work for the common case.
        hs_pipeline: "0",
        hs_pipeline_stage: "1",
        hs_ticket_priority: "MEDIUM",
      },
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HubSpot create-ticket failed (${res.status}): ${txt}`);
  }
  return res.json() as Promise<{ id: string }>;
}

async function appendNoteToTicket(
  accessToken: string,
  ticketId: string,
  args: {
    message: string;
    fromUser: { email?: string; name?: string };
  },
) {
  // Notes are CRM engagements. We create a note with the message body
  // and associate it to the ticket — that surfaces it inline in the
  // ticket's activity timeline, where reps actually look.
  const res = await fetch(`${HUBSPOT_API}/crm/v3/objects/notes`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        hs_note_body: prefixMessage(args.message, args.fromUser),
        hs_timestamp: Date.now(),
      },
      associations: [
        {
          to: { id: ticketId },
          // 228 = note → ticket (HubSpot's standard association type).
          types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 228 }],
        },
      ],
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HubSpot append-note failed (${res.status}): ${txt}`);
  }
}

/** Prefix the message body with the sender's name/email so the rep
 *  sees who said what when scanning the ticket timeline. */
function prefixMessage(text: string, from: { email?: string; name?: string }): string {
  const who = from.name && from.email
    ? `${from.name} <${from.email}>`
    : from.name ?? from.email ?? "Anonymous";
  return `**${who}**\n\n${text}`;
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
