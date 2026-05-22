import { NextResponse, type NextRequest } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { resolvePostLoginPath } from "@/lib/post-login-landing";

/** OAuth callback. Supabase redirects here with `?code=...` after Google.
 *  We exchange the code for a session and bounce on. The default landing
 *  splits by membership: owners → /dashboard, agent-only users →
 *  /workbench. An explicit `?next=` (e.g. deep link) wins over the
 *  default. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const explicitNext = url.searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
  }

  const supabase = await getServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin),
    );
  }

  const userId = data.user?.id;
  const landing =
    explicitNext ?? (userId ? await resolvePostLoginPath(userId) : "/dashboard");
  return NextResponse.redirect(new URL(landing, url.origin));
}
