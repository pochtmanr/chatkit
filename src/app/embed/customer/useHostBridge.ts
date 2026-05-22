"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Host ↔ iframe postMessage bridge for the customer widget.
 *
 * Protocol contract: prompts/round-5/0-shared.md §6. The bridge:
 *   1. Waits for `init` from the host with a 16-byte nonce + the host's
 *      expected origin. Verifies that origin matches `document.referrer`
 *      and `event.origin` before accepting the handshake.
 *   2. Echoes `ready` back to the host on the verified origin.
 *   3. On every subsequent inbound message, requires `event.origin` and
 *      the nonce to match the captured handshake — otherwise drops.
 *   4. `sign-out` tears down the captured bridge so the iframe refuses
 *      to render any session-bound UI until the host resends `init`.
 *
 * The narrow inbound types are the only commands the widget acts on;
 * everything else is silently ignored. Outbound targets the verified
 * host origin — never `'*'` after the handshake completes.
 */

type Inbound =
  | { v: 1; type: "init"; nonce: string; hostOrigin: string }
  | {
      v: 1;
      type: "open";
      nonce: string;
      kind?: "support" | "order" | "direct";
      externalRef?: string;
      startOptionId?: string;
    }
  | { v: 1; type: "close"; nonce: string }
  | { v: 1; type: "sign-out"; nonce: string };

type Outbound =
  | { v: 1; type: "ready"; nonce: string }
  | { v: 1; type: "open"; nonce: string; open: boolean }
  | { v: 1; type: "unread"; nonce: string; count: number };

export type HostOpenCommand = {
  kind?: "support" | "order" | "direct";
  externalRef?: string;
  startOptionId?: string;
};

export type UseHostBridgeOptions = {
  onOpen: (cmd: HostOpenCommand) => void;
  onClose: () => void;
  onSignOut: () => void;
};

export type UseHostBridgeResult = {
  /** Captured handshake (null until `init` is verified). */
  bridge: { hostOrigin: string; nonce: string } | null;
  /** Post a state update to the host on the verified origin. No-op
   *  before the handshake completes. */
  post: (kind: "open" | "unread", value: number | boolean) => void;
};

function isInbound(value: unknown): value is Inbound {
  if (!value || typeof value !== "object") return false;
  const v = value as { v?: unknown; type?: unknown; nonce?: unknown };
  if (v.v !== 1 || typeof v.type !== "string") return false;
  if (v.type === "init") return typeof v.nonce === "string";
  return typeof v.nonce === "string"
    && ["open", "close", "sign-out"].includes(v.type as string);
}

export function useHostBridge(opts: UseHostBridgeOptions): UseHostBridgeResult {
  const [bridge, setBridge] = useState<{ hostOrigin: string; nonce: string } | null>(
    null,
  );
  // Refs let the message listener read the latest callbacks without
  // re-binding (which would unregister the listener mid-handshake).
  // Update inside useLayoutEffect so the listener captured in the
  // effect below always reads post-commit values, even when the
  // browser dispatches a message between renders.
  const bridgeRef = useRef(bridge);
  const optsRef = useRef(opts);
  useLayoutEffect(() => {
    bridgeRef.current = bridge;
    optsRef.current = opts;
  });

  const post = useCallback<UseHostBridgeResult["post"]>((kind, value) => {
    const b = bridgeRef.current;
    if (!b || typeof window === "undefined") return;
    const payload: Outbound =
      kind === "unread"
        ? { v: 1, type: "unread", nonce: b.nonce, count: Number(value) }
        : { v: 1, type: "open", nonce: b.nonce, open: Boolean(value) };
    window.parent.postMessage(payload, b.hostOrigin);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onMsg = (e: MessageEvent) => {
      if (!isInbound(e.data)) return;
      const msg = e.data;

      if (msg.type === "init") {
        if (typeof document === "undefined") return;
        // The referrer pins the legitimate parent; we only trust the
        // handshake when all three sources agree (referrer === event
        // origin === claimed hostOrigin). Empty referrer (rare:
        // `noreferrer` on the iframe) is unrecoverable here — the
        // widget stays unhandshook and ignores further messages.
        let refOrigin: string | null = null;
        try {
          refOrigin = document.referrer ? new URL(document.referrer).origin : null;
        } catch {
          refOrigin = null;
        }
        if (!refOrigin || refOrigin !== e.origin || refOrigin !== msg.hostOrigin) {
          return;
        }
        setBridge({ hostOrigin: refOrigin, nonce: msg.nonce });
        const ready: Outbound = { v: 1, type: "ready", nonce: msg.nonce };
        window.parent.postMessage(ready, refOrigin);
        return;
      }

      const b = bridgeRef.current;
      if (!b) return;                          // pre-handshake → drop
      if (e.origin !== b.hostOrigin) return;   // wrong parent → drop
      if (msg.nonce !== b.nonce) return;       // nonce reuse / hijack → drop

      switch (msg.type) {
        case "open":
          optsRef.current.onOpen({
            kind: msg.kind,
            externalRef: msg.externalRef,
            startOptionId: msg.startOptionId,
          });
          break;
        case "close":
          optsRef.current.onClose();
          break;
        case "sign-out":
          optsRef.current.onSignOut();
          // Drop the captured handshake. The widget will ignore every
          // subsequent message until the host posts a fresh `init`
          // (typically after a full page reload that re-mints the JWT).
          setBridge(null);
          break;
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  return { bridge, post };
}
