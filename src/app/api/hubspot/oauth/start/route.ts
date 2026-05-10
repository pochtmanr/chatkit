import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { getServerClient } from "@/lib/supabase/server";

/**
 * Kick off HubSpot OAuth. The signed-in tenant owner hits this route;
 * we redirect them to HubSpot's grant page with our app's client id +
 * the scopes we need. HubSpot bounces them back to /oauth/callback.
 *
 * The `state` param carries the tenant id (server-signed via the
 * Supabase session cookie — only authenticated users can reach here)
 * so the callback knows which tenant to attach the tokens to.
 */
export async function GET(request: NextRequest) {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Find the tenant this user owns. (Bootstrap-on-signup guarantees
  // every signed-in user has at least one tenant row.)
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id")
    .eq("owner_user_id", user.id)
    .limit(1);
  const tenant = tenants?.[0];
  if (!tenant) {
    return NextResponse.redirect(
      new URL("/dashboard?error=no_tenant", request.url),
    );
  }

  const clientId = process.env.HUBSPOT_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(
      new URL(
        "/dashboard/settings?error=hubspot_not_configured",
        request.url,
      ),
    );
  }

  const origin = await siteOrigin();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/hubspot/oauth/callback`,
    // Granular tickets scopes — broader compatibility with Free CRM
    // tiers than the legacy `tickets` scope, which sometimes triggers
    // a "scopes mismatch" rejection on accounts without Service Hub.
    // Owner picker is gated behind crm.objects.owners.read; if your
    // HubSpot app can't grant that, the settings page falls back to
    // a manual owner-id input, so it's safe to drop.
    scope: "oauth crm.objects.tickets.read crm.objects.tickets.write",
    state: tenant.id,
  });
  return NextResponse.redirect(
    `https://app.hubspot.com/oauth/authorize?${params.toString()}`,
  );
}

async function siteOrigin() {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}
