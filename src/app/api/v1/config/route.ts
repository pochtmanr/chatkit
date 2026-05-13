import { NextResponse, type NextRequest } from "next/server";
import { authTenant, corsHeaders } from "@/lib/api-auth";

/**
 * Bootstrap config for the SDK. Returns the public-facing Supabase
 * Realtime endpoint + anon key so the SDK can subscribe to channels
 * like `conv:<id>` and receive new-message broadcasts.
 *
 * Auth: requires a valid api_key. We don't expose anon credentials
 * without verifying the caller represents an active tenant first,
 * which also means we can return per-tenant info later (custom
 * channel prefixes, feature flags, etc.) without changing the shape.
 *
 * The anon key is `NEXT_PUBLIC_…` and already public — but tunneling
 * it through this gated endpoint means the SDK doesn't have to ship
 * with the key hardcoded, and we control rotation centrally.
 */
export async function GET(request: NextRequest) {
  const auth = await authTenant(request);
  if ("error" in auth) return auth.error;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "server misconfigured: Supabase env vars missing" },
      { status: 500, headers: corsHeaders },
    );
  }

  return NextResponse.json(
    {
      tenant: {
        id: auth.tenant.id,
        name: auth.tenant.name,
      },
      realtime: {
        supabase_url: supabaseUrl,
        supabase_anon_key: supabaseAnonKey,
        // Channel name prefix. SDK appends the conversation id so
        // every conversation gets its own broadcast channel.
        channel_prefix: "conv:",
      },
    },
    { headers: corsHeaders },
  );
}

export function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}
