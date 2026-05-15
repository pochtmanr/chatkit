"use client";

import { useEffect, useRef, useState } from "react";

const COLLAPSED = { width: 88, height: 88 };
const EXPANDED = { width: 380, height: 600 };

export function SupportWidget({ apiKey }: { apiKey: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [open, setOpen] = useState(false);
  const readyRef = useRef(false);
  const pendingRef = useRef(false);

  // The iframe announces FAB↔panel transitions via `chat-admin:widget`
  // messages (see WidgetShell). Resize our wrapper to match so the
  // outer page reserves only as much space as the panel needs. Also
  // treat the first such message as "iframe is mounted and listening"
  // so we can flush a queued open click.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const data = e.data;
      if (!data || typeof data !== "object") return;
      if ((data as { type?: string }).type === "chat-admin:widget") {
        readyRef.current = true;
        setOpen(Boolean((data as { open?: boolean }).open));
        flushPending();
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const postOpen = () => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "chat-admin:open", kind: "support" },
      "*",
    );
  };

  const flushPending = () => {
    if (!pendingRef.current) return;
    pendingRef.current = false;
    postOpen();
  };

  // Any [data-tinychat-open] button on the host page deep-links into
  // the panel — WidgetShell listens for `chat-admin:open` and flips
  // from FAB to list/thread view. If the iframe hasn't booted yet,
  // queue the intent and replay it once the iframe announces itself.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = (e.target as Element | null)?.closest(
        "[data-tinychat-open]",
      );
      if (!target) return;
      if (readyRef.current) {
        postOpen();
      } else {
        pendingRef.current = true;
      }
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  const handleLoad = () => {
    // iframe document is loaded, but the React tree inside may still
    // be wiring its message listener — give it a tick before flushing.
    setTimeout(() => {
      readyRef.current = true;
      flushPending();
    }, 80);
  };

  const dims = open ? EXPANDED : COLLAPSED;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 transition-[width,height] duration-200 ease-out"
      style={{ width: dims.width, height: dims.height }}
    >
      <iframe
        ref={iframeRef}
        onLoad={handleLoad}
        src={`/embed/widget?key=${encodeURIComponent(apiKey)}`}
        title="TinyChat support"
        allow="clipboard-write"
        className="w-full h-full border-0 bg-transparent rounded-2xl"
      />
    </div>
  );
}
