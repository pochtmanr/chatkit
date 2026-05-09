import { NextResponse, type NextRequest } from "next/server";
import { getServerClient, getServiceClient } from "@/lib/supabase/server";

/** OAuth callback. Supabase redirects here with `?code=...` after Google.
 *  We exchange the code for a session, then make sure the signed-in user
 *  owns at least one tenant (bootstrap on first login). */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/dashboard";

  // No code → bounced back from an error / direct hit. Send them home.
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
  }

  const supabase = await getServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin),
    );
  }

  // Make sure this user has a tenant. First-time Google sign-in lands here
  // with no signup form, so we synthesize a tenant from their auth profile.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await ensureTenant(user);
  }

  return NextResponse.redirect(new URL(next, url.origin));
}

type AuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: { full_name?: string; name?: string } | null;
};

async function ensureTenant(user: AuthUser) {
  const service = getServiceClient();
  const { data: existing } = await service
    .from("tenants")
    .select("id")
    .eq("owner_user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (existing) return;

  const display =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "My workspace";
  const baseSlug = slugify(display);
  await service.from("tenants").insert({
    owner_user_id: user.id,
    name: display,
    slug: `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`,
    api_key: newApiKey(),
    plan: "starter",
  });
}

function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "tenant"
  );
}

function newApiKey() {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return "pk_live_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
