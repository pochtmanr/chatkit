import crypto from "node:crypto";

/**
 * HMAC-SHA256 webhook signing (Stripe-style).
 *
 *   timestamp        = unix seconds at send time
 *   signed_payload   = `${timestamp}.${json_body}`
 *   v1               = hex(hmac_sha256(webhook_secret, signed_payload))
 *
 * Header form:
 *
 *   X-Chatkit-Signature: t=<seconds>,v1=<hex>[,v1=<hex>]
 *
 * Receivers split on commas, then on `=`. Reject if `|now - t|` exceeds
 * a tolerance (we recommend 5 minutes), recompute `v1` over their stored
 * secret, and compare with constant-time equality.
 *
 * During a secret rotation we emit a second `v1=` over the previous
 * secret for 24 hours, so receivers who haven't picked up the new
 * secret yet still verify.
 */

const ROTATION_GRACE_MS = 24 * 60 * 60 * 1000;

export interface SignatureInputs {
  /** Active signing secret. `null` skips signing entirely. */
  secret: string | null;
  /** Previous secret retained for rotation. */
  previousSecret: string | null;
  /** ISO timestamp the previous secret was retired. */
  rotatedAt: string | null;
}

export interface SignedHeaders {
  timestamp: number;
  header: string;
  body: string;
}

function v1(secret: string, payload: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/** Builds the `X-Chatkit-Signature` header value. Returns `null` if
 *  no secret is configured (legacy inbox left unsigned). */
export function signWebhookBody(
  body: string,
  inputs: SignatureInputs,
  nowMs: number = Date.now(),
): SignedHeaders | null {
  if (!inputs.secret) return null;
  const timestamp = Math.floor(nowMs / 1000);
  const signedPayload = `${timestamp}.${body}`;
  const parts: string[] = [`t=${timestamp}`, `v1=${v1(inputs.secret, signedPayload)}`];

  if (inputs.previousSecret && inputs.rotatedAt) {
    const rotatedAtMs = Date.parse(inputs.rotatedAt);
    if (Number.isFinite(rotatedAtMs) && nowMs - rotatedAtMs < ROTATION_GRACE_MS) {
      parts.push(`v1=${v1(inputs.previousSecret, signedPayload)}`);
    }
  }

  return { timestamp, body, header: parts.join(",") };
}
