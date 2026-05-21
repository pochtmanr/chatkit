"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getServerClient, getServiceClient } from "@/lib/supabase/server";
import { createOrder } from "@/lib/revolut";

type Ok<T = Record<string, never>> = { ok: true } & T;
type Err = { ok: false; error: string };
type ActionResult<T = Record<string, never>> = Ok<T> | Err;

export async function requestRevolutCheckout(
  planId: string,
): Promise<ActionResult<{ checkoutUrl: string }>> {
  const sb = await getServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "not signed in" };

  const cookieStore = await cookies();
  const businessId = cookieStore.get("chatkit_active_biz")?.value;
  if (!businessId) return { ok: false, error: "no active business" };

  // RLS will block if the user doesn't own the business.
  const { data: biz } = await sb
    .from("businesses")
    .select("id, name, contact_email")
    .eq("id", businessId)
    .maybeSingle();
  if (!biz) return { ok: false, error: "business not found" };

  const admin = getServiceClient();
  const { data: plan } = await admin
    .from("plans")
    .select("id, name, monthly_price_cents, currency")
    .eq("id", planId)
    .maybeSingle();
  if (!plan) return { ok: false, error: "unknown plan" };
  if (plan.monthly_price_cents <= 0) {
    return { ok: false, error: "this plan isn't priced yet" };
  }

  // Draft invoice up front — flipped to 'paid' from the webhook on
  // success, or to 'failed' if order creation throws.
  const now = new Date();
  const periodStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const periodEnd = new Date(periodStart);
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);

  const { data: invoice, error: invErr } = await admin
    .from("invoices")
    .insert({
      business_id: biz.id,
      plan_id: plan.id,
      amount_cents: plan.monthly_price_cents,
      currency: plan.currency,
      status: "draft",
      period_start: periodStart.toISOString().slice(0, 10),
      period_end: periodEnd.toISOString().slice(0, 10),
    })
    .select("id")
    .single();
  if (invErr || !invoice) {
    return {
      ok: false,
      error: invErr?.message ?? "couldn't create invoice draft",
    };
  }

  const redirect = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/dashboard/settings/billing?paid=1`;
  try {
    const order = await createOrder({
      amountCents: plan.monthly_price_cents,
      currency: plan.currency,
      description: `${plan.name} plan — ${biz.name}`,
      metadata: {
        invoice_id: invoice.id,
        business_id: biz.id,
        plan_id: plan.id,
      },
      customerEmail: biz.contact_email ?? user.email ?? undefined,
      redirectUrl: redirect,
    });

    await admin
      .from("invoices")
      .update({ revolut_order_id: order.id, status: "open" })
      .eq("id", invoice.id);

    await admin.from("billing_events").insert({
      business_id: biz.id,
      kind: "revolut_order.created",
      payload: {
        invoice_id: invoice.id,
        order_id: order.id,
        amount_cents: plan.monthly_price_cents,
      },
    });

    return { ok: true, checkoutUrl: order.checkout_url };
  } catch (e) {
    await admin
      .from("invoices")
      .update({ status: "failed" })
      .eq("id", invoice.id);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "checkout failed",
    };
  } finally {
    revalidatePath("/dashboard/settings/billing");
  }
}

export async function listInvoices(businessId: string) {
  const sb = await getServerClient();
  const { data } = await sb
    .from("invoices")
    .select(
      "id, plan_id, amount_cents, currency, status, paid_at, period_start, period_end, hosted_invoice_url, created_at",
    )
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}
