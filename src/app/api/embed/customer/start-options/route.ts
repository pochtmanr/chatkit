import { NextResponse, type NextRequest } from "next/server";
import { authCustomer } from "@/lib/customer-auth";
import { getServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/embed/customer/start-options
 *   Returns the active start options for the inbox the JWT is scoped
 *   to, filtered down to `kind`s the JWT actually allows. We never
 *   expose options the user can't pick — that would invite UX where
 *   tapping a topic 403s on the find endpoint.
 *
 *   The handler also strips `business_id`/`inbox_id`; those are
 *   redundant for the browser and we'd rather not paint internal ids
 *   into the widget runtime.
 */
export async function GET(request: NextRequest) {
  const auth = await authCustomer(request);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const svc = getServiceClient();
  const { data, error } = await svc
    .from("conversation_start_options")
    .select("id, label, description, icon, kind, required_skills, sort_order")
    .eq("inbox_id", session.inboxId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }

  const allowed = new Set(session.claims.allowed_kinds);
  const options = (data ?? []).filter((o) => allowed.has(o.kind as never));

  return NextResponse.json({ options });
}
