import crypto from "node:crypto";

const SANDBOX_BASE = "https://sandbox-merchant.revolut.com/api/1.0";
const PRODUCTION_BASE = "https://merchant.revolut.com/api/1.0";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env var: ${name}`);
  return v;
}

function baseUrl(): string {
  const env = process.env.REVOLUT_ENVIRONMENT ?? "sandbox";
  return env === "production" ? PRODUCTION_BASE : SANDBOX_BASE;
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${requireEnv("REVOLUT_SECRET_KEY")}`,
    "Content-Type": "application/json",
    "Revolut-Api-Version": "2024-09-01",
  };
}

export type RevolutOrder = {
  id: string;
  state:
    | "PENDING"
    | "PROCESSING"
    | "AUTHORISED"
    | "COMPLETED"
    | "CANCELLED"
    | "FAILED";
  amount: number;
  currency: string;
  checkout_url: string;
  customer?: { id?: string; email?: string };
};

export async function createOrder(input: {
  amountCents: number;
  currency: string;
  description: string;
  metadata: Record<string, string>;
  customerEmail?: string;
  redirectUrl: string;
}): Promise<RevolutOrder> {
  const res = await fetch(`${baseUrl()}/orders`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      amount: input.amountCents,
      currency: input.currency,
      description: input.description,
      capture_mode: "automatic",
      merchant_order_ext_ref: input.metadata.invoice_id,
      redirect_url: input.redirectUrl,
      customer: input.customerEmail
        ? { email: input.customerEmail }
        : undefined,
      metadata: input.metadata,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Revolut createOrder failed: ${res.status} ${text}`);
  }
  return (await res.json()) as RevolutOrder;
}

export async function retrieveOrder(id: string): Promise<RevolutOrder> {
  const res = await fetch(`${baseUrl()}/orders/${id}`, {
    method: "GET",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Revolut retrieveOrder failed: ${res.status} ${text}`);
  }
  return (await res.json()) as RevolutOrder;
}

/**
 * Verify a Revolut webhook signature. Revolut signs the raw body with
 * HMAC-SHA256 using REVOLUT_WEBHOOK_SECRET and sends the result in the
 * `Revolut-Signature` header as `v1=<hex>` (potentially comma-separated
 * across rotations). Constant-time compare on hex buffers.
 */
export function verifyWebhookSignature(
  rawBody: string,
  header: string | null,
): boolean {
  if (!header) return false;
  const secret = requireEnv("REVOLUT_WEBHOOK_SECRET");
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  const provided = header
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.startsWith("v1="))
    .map((s) => s.slice(3));

  if (provided.length === 0) return false;

  return provided.some((sig) => {
    try {
      const a = Buffer.from(expected, "hex");
      const b = Buffer.from(sig, "hex");
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  });
}
