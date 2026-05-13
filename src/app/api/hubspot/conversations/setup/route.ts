/**
 * Dashboard-authed: one-time HubSpot Conversations setup for a tenant.
 *
 * Flow:
 *   1. Reuse the app-level Custom Channel id (created once via the
 *      developer key + appId) if already present in env. Otherwise
 *      create the channel and persist its id on the tenant row.
 *   2. Create a per-tenant ChannelAccount under that channel, bound to
 *      the chosen Inbox. The deliveryIdentifier we register here is the
 *      "from" address agents see in the inbox UI.
 *   3. Flip `hubspot_conversations_mode = true` so subsequent message
 *      writes/reads use the Conversations API instead of Tickets+Notes.
 *
 * Body:
 *   { inbox_id: string, identifier_email: string }
 *
 * Requires the signed-in user to own the tenant. We *don't* let the SDK
 * trigger this — channel-account creation is a privileged + one-time
 * operation and we want the tenant owner to see it succeed in their
 * own dashboard before the chat starts routing messages here.
 */

import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { getServerClient, getServiceClient } from "@/lib/supabase/server";
import {
  createCustomChannel,
  createChannelAccount,
} from "@/lib/hubspot-conversations";

export async function POST(request: NextRequest) {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // Find the tenant this signed-in user owns.
  const { data: tenant } = await supabase
    .from("tenants")
    .select(
      "id, integration_type, hubspot_custom_channel_id, hubspot_channel_account_id, hubspot_conversations_mode",
    )
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (!tenant) {
    return NextResponse.json({ error: "no tenant found" }, { status: 404 });
  }
  if (tenant.integration_type !== "hubspot") {
    return NextResponse.json(
      { error: "tenant has not connected HubSpot yet" },
      { status: 400 },
    );
  }

  let payload: { inbox_id?: string; identifier_email?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!payload.inbox_id || !payload.identifier_email) {
    return NextResponse.json(
      { error: "inbox_id and identifier_email are required" },
      { status: 400 },
    );
  }

  // -------------------------------------------------------------------
  // Step 1: ensure the app-level Custom Channel exists. We cache the id
  // in env (HUBSPOT_CUSTOM_CHANNEL_ID) once created — channels live at
  // the *developer app* layer, so all tenants share the same channel id.
  // First tenant to set up creates it; subsequent ones reuse.
  // -------------------------------------------------------------------
  const service = getServiceClient();
  let channelId = process.env.HUBSPOT_CUSTOM_CHANNEL_ID ?? null;
  if (!channelId) {
    const devKey = process.env.HUBSPOT_DEVELOPER_API_KEY;
    const appId = process.env.HUBSPOT_APP_ID;
    if (!devKey || !appId) {
      return NextResponse.json(
        {
          error:
            "HUBSPOT_DEVELOPER_API_KEY + HUBSPOT_APP_ID env vars required to create the Custom Channel for the first time",
        },
        { status: 500 },
      );
    }
    try {
      const channel = await createCustomChannel({
        developerApiKey: devKey,
        appId,
        name: `${process.env.NEXT_PUBLIC_BRAND_NAME ?? "Chat"} Custom Channel`,
        webhookUrl: `${await siteOrigin()}/api/hubspot/webhook`,
      });
      channelId = channel.id;
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "channel create failed" },
        { status: 502 },
      );
    }
  }

  // -------------------------------------------------------------------
  // Step 2: create the per-tenant ChannelAccount under that channel.
  // Idempotent in the sense that if one already exists we don't try to
  // create another — the agent UI would show two duplicate inboxes.
  // -------------------------------------------------------------------
  if (tenant.hubspot_channel_account_id) {
    return NextResponse.json({
      channel_id: channelId,
      channel_account_id: tenant.hubspot_channel_account_id,
      already_provisioned: true,
    });
  }

  let channelAccount;
  try {
    channelAccount = await createChannelAccount({
      tenantId: tenant.id,
      channelId,
      inboxId: payload.inbox_id,
      name: payload.identifier_email,
      identifierEmail: payload.identifier_email,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "channel-account create failed",
      },
      { status: 502 },
    );
  }

  // -------------------------------------------------------------------
  // Step 3: persist the ids and flip on conversations mode.
  // -------------------------------------------------------------------
  const { error: updErr } = await service
    .from("tenants")
    .update({
      hubspot_custom_channel_id: channelId,
      hubspot_channel_account_id: channelAccount.id,
      hubspot_channel_account_email: payload.identifier_email,
      hubspot_inbox_id: payload.inbox_id,
      hubspot_conversations_mode: true,
    })
    .eq("id", tenant.id);
  if (updErr) {
    return NextResponse.json(
      { error: `persist failed: ${updErr.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    channel_id: channelId,
    channel_account_id: channelAccount.id,
    channel_account_email: payload.identifier_email,
    inbox_id: payload.inbox_id,
  });
}

async function siteOrigin() {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}
