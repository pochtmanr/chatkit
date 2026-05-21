import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // /embed/* paths set their CSP frame-ancestors dynamically from the
  // owning business's allowed_origins. Bail out before the auth-cookie
  // round-trip; embed requests don't have a chat-admin session anyway.
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

  // Refreshes session if expired and writes cookies back.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Auth gate — unauthenticated /dashboard hits go to /login.
  if (path.startsWith("/dashboard") && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  // Inverse: signed-in users hitting /login or /signup → /dashboard.
  if ((path === "/login" || path === "/signup") && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Onboarding gate — only fires under /dashboard/*. Sub-routes get
  // bounced to /dashboard, which renders the modal. /dashboard itself
  // is allowed through so the modal can render in place.
  if (user && path.startsWith("/dashboard") && path !== "/dashboard") {
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

  return response;
}

/** Build the /embed/* response with a per-business CSP frame-ancestors
 *  header. The embedding host's iframe is gated browser-side by this
 *  CSP; the page itself separately re-validates the Origin in
 *  src/lib/embed-auth.ts. Two layers, same source of truth (the
 *  business's `allowed_origins` column).
 *
 *  We look up by `?key=<inbox api key>`. If the key is missing or
 *  unknown, we still serve the page but with a restrictive CSP, so
 *  the iframe load fails clearly instead of leaking that the key
 *  was wrong vs. the origin was wrong. */
async function embedResponse(request: NextRequest): Promise<NextResponse> {
  const key = request.nextUrl.searchParams.get("key");
  const allowed = await lookupAllowedOrigins(key);
  const frameAncestors = ["'self'", ...allowed].join(" ");

  const response = NextResponse.next({ request });
  response.headers.set(
    "Content-Security-Policy",
    `frame-ancestors ${frameAncestors}`,
  );
  return response;
}

/** Returns the embedding business's `allowed_origins`, or [] if the
 *  key is missing/unknown/inactive. Uses the service role client
 *  because /embed/* requests are anonymous (no auth cookie). */
async function lookupAllowedOrigins(
  key: string | null,
): Promise<string[]> {
  if (!key) return [];
  if (!key.startsWith("pk_live_") && !key.startsWith("pk_test_")) return [];
  try {
    const sb = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
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
