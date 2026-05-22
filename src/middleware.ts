import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";

type Role = "owner" | "manager" | "agent" | null;

const ACTIVE_BIZ_COOKIE = "chatkit_active_biz";

// Paths only Admin (business owner) can reach. Manager/agent get bounced
// to /workbench.
const ADMIN_ONLY_PREFIXES = [
  "/dashboard/settings/billing",
  "/dashboard/settings/business",
  "/dashboard/settings/mcp",
  "/dashboard/settings/api-keys",
  "/dashboard/webhooks",
  "/dashboard/businesses",
  "/dashboard/inboxes",
];

// Paths Admin + Manager can reach (agents redirect to /workbench).
const MANAGER_PREFIXES = [
  "/dashboard/settings/team",
  "/dashboard/team",
];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (path.startsWith("/embed/")) {
    return embedResponse(request);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (path.startsWith("/dashboard") && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  if ((path === "/login" || path === "/signup") && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (!user) return response;

  // Resolve the active business + role. If the active-business cookie is
  // missing, we let through — the onboarding gate / active-context resolver
  // handle the empty state.
  const activeBizId = request.cookies.get(ACTIVE_BIZ_COOKIE)?.value ?? null;
  let role: Role = null;
  if (activeBizId) {
    role = await resolveRole(activeBizId, user.id);
  }

  // Onboarding gate — owners with zero completed businesses fall back to
  // /dashboard. Skip for agents/managers (they don't own a business).
  if (path.startsWith("/dashboard") && path !== "/dashboard" && role !== "agent" && role !== "manager") {
    const { count } = await supabase
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .eq("owner_user_id", user.id)
      .not("onboarding_completed_at", "is", null);
    if (!count) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // Role-based path guards. Admin (business owner) reaches everything.
  // We only redirect when we explicitly know the caller is a manager or
  // agent — a `null` role means the active-business cookie is missing or
  // points at a business we couldn't resolve, in which case the page
  // layer (requireOwner/etc.) is the authoritative gate. Otherwise an
  // admin who hasn't yet had the cookie set (fresh signup, post-invite,
  // etc.) gets bounced out of their own settings.
  if (role === "agent" || role === "manager") {
    if (ADMIN_ONLY_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
      return redirectTo(request, "/workbench");
    }
    if (role === "agent" && MANAGER_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
      return redirectTo(request, "/workbench");
    }
    if (path === "/dashboard" && role === "agent") {
      return redirectTo(request, "/workbench");
    }
  }

  return response;
}

function redirectTo(request: NextRequest, pathname: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

/** Look up the caller's effective role for `businessId`. Owner is checked
 *  first (cheap single-column read); falls back to a support_agents lookup.
 *  Returns null if the user has no relationship to the business. */
async function resolveRole(businessId: string, userId: string): Promise<Role> {
  const admin = serviceClient();
  const { data: biz } = await admin
    .from("businesses")
    .select("owner_user_id")
    .eq("id", businessId)
    .maybeSingle();
  if (!biz) return null;
  if (biz.owner_user_id === userId) return "owner";

  const { data: agent } = await admin
    .from("support_agents")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .is("archived_at", null)
    .not("accepted_at", "is", null)
    .maybeSingle();
  if (!agent) return null;
  return agent.role === "manager" ? "manager" : "agent";
}

function serviceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/** Build the /embed/* response with a per-business CSP frame-ancestors
 *  header. The embedding host's iframe is gated browser-side by this
 *  CSP; the page itself separately re-validates the Origin in
 *  src/lib/embed-auth.ts. Two layers, same source of truth (the
 *  business's `allowed_origins` column).
 *
 *  /embed/inbox is reserved for round 6 and must not embed anywhere —
 *  see prompts/round-5/2-surface-split.md §"Step 2".
 *  /embed/widget is the legacy customer surface and 308 redirects to
 *  /embed/customer; we still want a working frame-ancestors on it so
 *  the redirect doesn't get blocked by a stricter parent CSP. */
async function embedResponse(request: NextRequest): Promise<NextResponse> {
  const path = request.nextUrl.pathname;
  const response = NextResponse.next({ request });

  if (path === "/embed/inbox" || path.startsWith("/embed/inbox/")) {
    response.headers.set("Content-Security-Policy", "frame-ancestors 'none'");
    return response;
  }

  const key = request.nextUrl.searchParams.get("key");
  const allowed = await lookupAllowedOrigins(key);
  const frameAncestors = ["'self'", ...allowed].join(" ");
  response.headers.set(
    "Content-Security-Policy",
    `frame-ancestors ${frameAncestors}`,
  );
  return response;
}

async function lookupAllowedOrigins(
  key: string | null,
): Promise<string[]> {
  if (!key) return [];
  if (!key.startsWith("pk_live_") && !key.startsWith("pk_test_")) return [];
  try {
    const sb = serviceClient();
    const { data } = await sb
      .from("inboxes")
      .select(`business:businesses (status, allowed_origins)`)
      .eq("api_key", key)
      .maybeSingle();
    const b = data?.business
      ? Array.isArray(data.business)
        ? data.business[0]
        : data.business
      : null;
    if (!b || b.status !== "active") return [];
    return Array.isArray(b.allowed_origins) ? b.allowed_origins : [];
  } catch {
    return [];
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp)$).*)"],
};
