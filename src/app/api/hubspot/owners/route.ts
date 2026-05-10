import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { getValidAccessToken } from "@/lib/hubspot";

/**
 * Lists the HubSpot owners (users + teams) the connected account has,
 * so the settings page can render a dropdown for picking who to assign
 * relay-created tickets to. Auth: must be the signed-in tenant owner.
 */
export async function GET() {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, integration_type")
    .eq("owner_user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!tenant) {
    return NextResponse.json({ error: "no tenant" }, { status: 404 });
  }
  if (tenant.integration_type !== "hubspot") {
    return NextResponse.json({ error: "hubspot not connected" }, { status: 400 });
  }

  try {
    const accessToken = await getValidAccessToken(tenant.id);
    const res = await fetch(
      "https://api.hubapi.com/crm/v3/owners?limit=100",
      { headers: { authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json(
        { error: `HubSpot owners fetch failed (${res.status}): ${txt}` },
        { status: 502 },
      );
    }
    const data = (await res.json()) as {
      results: Array<{
        id: string;
        email?: string;
        firstName?: string;
        lastName?: string;
        userId?: number;
      }>;
    };
    // Trim to just what the dropdown needs.
    return NextResponse.json({
      owners: data.results.map((o) => ({
        id: o.id,
        email: o.email ?? null,
        name: [o.firstName, o.lastName].filter(Boolean).join(" ") || null,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
