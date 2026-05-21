import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { verifyWebhookSignature } from "@/lib/revolut";

// Force Node.js runtime — we need crypto + raw body access.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("revolut-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json(
      { ok: false, error: "invalid signature" },
      { status: 401 },
    );
  }

  let payload: {
    event: string;
    order_id?: string;
    data?: Record<string, unknown>;
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid JSON" },
      { status: 400 },
    );
  }

  const admin = getServiceClient();

  // Key on order_id since it arrives in every payload. metadata carries
  // invoice_id from order creation but isn't echoed in every event.
  const orderId =
    payload.order_id ?? (payload.data as { id?: string } | undefined)?.id;
  if (!orderId) {
    await admin.from("billing_events").insert({
      business_id: null,
      kind: `revolut.${payload.event}.no_order_id`,
      payload: payload as unknown as Json,
    });
    return NextResponse.json({ ok: true });
  }

  const { data: invoice } = await admin
    .from("invoices")
    .select("id, business_id, plan_id, status")
    .eq("revolut_order_id", orderId)
    .maybeSingle();

  if (!invoice) {
    await admin.from("billing_events").insert({
      business_id: null,
      kind: `revolut.${payload.event}.no_invoice`,
      payload: { order_id: orderId, payload } as unknown as Json,
    });
    return NextResponse.json({ ok: true });
  }

  switch (payload.event) {
    case "ORDER_COMPLETED": {
      if (invoice.status !== "paid") {
        const now = new Date().toISOString();
        await admin
          .from("invoices")
          .update({ status: "paid", paid_at: now })
          .eq("id", invoice.id);

        const renewsAt = new Date(
          Date.now() + 31 * 24 * 60 * 60 * 1000,
        ).toISOString();
        await admin
          .from("businesses")
          .update({
            current_plan_id: invoice.plan_id,
            plan_renews_at: renewsAt,
            status: "active",
          })
          .eq("id", invoice.business_id);
      }
      break;
    }
    case "ORDER_FAILED":
    case "ORDER_CANCELLED": {
      await admin
        .from("invoices")
        .update({
          status: payload.event === "ORDER_FAILED" ? "failed" : "draft",
        })
        .eq("id", invoice.id);
      break;
    }
    case "ORDER_REFUNDED": {
      await admin
        .from("invoices")
        .update({ status: "refunded" })
        .eq("id", invoice.id);
      break;
    }
    default:
      // Unknown event — log via billing_events below + 200.
      break;
  }

  await admin.from("billing_events").insert({
    business_id: invoice.business_id,
    kind: `revolut.${payload.event}`,
    payload: payload as unknown as Json,
  });

  return NextResponse.json({ ok: true });
}
