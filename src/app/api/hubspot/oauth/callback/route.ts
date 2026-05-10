import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { getServerClient, getServiceClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens, getPortalInfo } from "@/lib/hubspot";

/**
 * HubSpot redirects here after the tenant owner approves our app.
 * We exchange the auth code for tokens and persist them on the tenant
 * row, then bounce the user back to the settings page.
 *
 * `state` carries the tenant id (set in /oauth/start). We still
 * verify the signed-in user owns that tenant — defense in depth in
 * case someone forges the state value.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // tenant id
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/settings?hubspot_error=${encodeURIComponent(oauthError)}`,
        url.origin,
      ),
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?hubspot_error=missing_params", url.origin),
    );
  }

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  // Confirm the state belongs to a tenant owned by this user.
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("id", state)
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (!tenant) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?hubspot_error=state_mismatch", url.origin),
    );
  }

  try {
    const origin = await siteOrigin();
    const tokens = await exchangeCodeForTokens(
      code,
      `${origin}/api/hubspot/oauth/callback`,
    );
    const portal = await getPortalInfo(tokens.access_token);

    const service = getServiceClient();
    await service
      .from("tenants")
      .update({
        integration_type: "hubspot",
        hubspot_access_token: tokens.access_token,
        hubspot_refresh_token: tokens.refresh_token,
        hubspot_token_expires_at: new Date(
          Date.now() + tokens.expires_in * 1000,
        ).toISOString(),
        hubspot_portal_id: String(portal.portal_id),
      })
      .eq("id", tenant.id);

    return NextResponse.redirect(
      new URL("/dashboard/settings?hubspot=connected", url.origin),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.redirect(
      new URL(
        `/dashboard/settings?hubspot_error=${encodeURIComponent(msg)}`,
        url.origin,
      ),
    );
  }
}

async function siteOrigin() {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}
