import { NextRequest, NextResponse } from "next/server";
import { dispatchPendingWebhooks } from "@/lib/tenant-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH_SIZE = 25;

/** Vercel Cron drainer for `pending_webhooks`.
 *
 *  Round-4 auto-assignment fires via SQL triggers, which can't make
 *  outbound HTTP calls. Triggers + Workbench server actions enqueue
 *  rows here; this route drains them in batches and POSTs to each
 *  inbox's `webhook_url`. Schedule lives in `vercel.json` at one minute.
 *
 *  Auth: `CRON_SECRET` matches the convention used by the existing
 *  /api/cron/execute-deletions route. Vercel attaches the secret via
 *  the request authorization header when invoking the cron in
 *  production; missing-secret environments simply allow execution.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json(
      { ok: false, error: "unauthorised" },
      { status: 401 },
    );
  }

  const stats = await dispatchPendingWebhooks(BATCH_SIZE);
  return NextResponse.json({ ok: true, ...stats });
}
