"use client";

/**
 * Browser-side fetch wrapper for /api/embed/customer/* calls.
 *
 * Sends the publishable key in `x-holylabs-pk` and the widget JWT in
 * `Authorization`. The two headers are checked together server-side
 * (see src/lib/customer-auth.ts) — both are required.
 *
 * Refresh policy: when the JWT expires, the server returns 401. The
 * widget treats that as "host must mint a new token" and reloads the
 * page so the next `init` handshake carries a fresh `?token=`. Round 6
 * will add a postMessage `auth` channel so reloads aren't required.
 */
export type CustomerFetch = (input: string, init?: RequestInit) => Promise<Response>;

export function customerFetch(opts: { pk: string; token: string }): CustomerFetch {
  return (input, init = {}) => {
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${opts.token}`);
    headers.set("x-holylabs-pk", opts.pk);
    return fetch(input, { ...init, headers });
  };
}
