import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json(
      { ok: false, error: "unauthorised" },
      { status: 401 },
    );
  }

  const admin = getServiceClient();
  const nowIso = new Date().toISOString();

  const { data: due } = await admin
    .from("deletion_requests")
    .select("id, user_id, kind, business_id")
    .is("executed_at", null)
    .is("cancelled_at", null)
    .lte("scheduled_at", nowIso)
    .limit(100);

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const row of due ?? []) {
    try {
      if (row.kind === "business_data" && row.business_id) {
        const { data: biz } = await admin
          .from("businesses")
          .select("id, owner_user_id")
          .eq("id", row.business_id)
          .maybeSingle();
        if (biz && biz.owner_user_id === row.user_id) {
          await admin.from("businesses").delete().eq("id", row.business_id);
        }
      } else if (row.kind === "account") {
        await admin.auth.admin.deleteUser(row.user_id);
      }
      await admin
        .from("deletion_requests")
        .update({ executed_at: nowIso })
        .eq("id", row.id);
      results.push({ id: row.id, ok: true });
    } catch (e) {
      results.push({
        id: row.id,
        ok: false,
        error: e instanceof Error ? e.message : "unknown",
      });
    }
  }

  // Data export job is not implemented yet; flip queued rows to failed so
  // the UI surfaces the state. Round 4 builds the actual JSON dump.
  const { data: queued } = await admin
    .from("data_export_requests")
    .select("id")
    .eq("status", "queued")
    .limit(50);
  for (const ex of queued ?? []) {
    await admin
      .from("data_export_requests")
      .update({ status: "failed", error: "NOT_IMPLEMENTED" })
      .eq("id", ex.id);
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
