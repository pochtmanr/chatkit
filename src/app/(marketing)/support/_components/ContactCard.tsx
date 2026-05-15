import { ArrowRight, MessageCircle } from "lucide-react";

export function ContactCard({ hasWidget = false }: { hasWidget?: boolean }) {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <div className="bg-mist rounded-[48px] border border-mist shadow-sm overflow-hidden">
        <div className="bg-white rounded-[40px] m-2 shadow-sm">
          <div className="p-8 md:p-10 lg:p-12 grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-10 items-center">
            <div>
              <p className="text-[14px] font-medium text-deep/60">Live chat</p>
              <h2 className="mt-4 text-4xl sm:text-5xl tracking-tight text-ink leading-[1] font-normal">
                We use TinyChat{" "}
                <span className="font-serif-italic text-deep">
                  for our own support<span className="text-deep/40">.</span>
                </span>
              </h2>
              <p className="mt-5 text-deep/70 leading-relaxed text-[16px] max-w-[480px]">
                The little red bubble down there is the exact widget you&apos;ll
                ship to your users — same iframe, same SDK. Open it and we&apos;ll
                answer from our own inbox.
              </p>
              {hasWidget ? (
                <button
                  type="button"
                  data-tinychat-open
                  className="mt-8 group inline-flex items-center gap-2 rounded-full bg-ink text-white pl-5 pr-2 py-2 text-[15px] shadow-lg shadow-ink/10 hover:bg-deep transition-colors"
                >
                  Open the widget
                  <span className="grid place-items-center h-7 w-7 rounded-full bg-white text-ink transition-transform group-hover:translate-x-0.5">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </button>
              ) : (
                <a
                  href="mailto:support@tinychat.dev"
                  className="mt-8 group inline-flex items-center gap-2 rounded-full bg-ink text-white pl-5 pr-2 py-2 text-[15px] shadow-lg shadow-ink/10 hover:bg-deep transition-colors"
                >
                  Email support
                  <span className="grid place-items-center h-7 w-7 rounded-full bg-white text-ink transition-transform group-hover:translate-x-0.5">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </a>
              )}
            </div>

            {/* Decorative chat-bubble mock pointing toward the FAB */}
            <div className="relative h-64 hidden lg:block">
              <MockBubble
                tone="mist"
                text="How do I install the widget?"
                className="absolute left-2 top-2 -rotate-3"
              />
              <MockBubble
                tone="ink"
                text="Drop the script tag and you're live in 60s."
                className="absolute right-4 top-20 rotate-2"
              />
              <div className="absolute right-2 bottom-2 grid place-items-center h-14 w-14 rounded-full bg-red-600 text-white shadow-2xl ring-4 ring-white">
                <MessageCircle className="h-6 w-6" />
              </div>
              {/* Dashed arrow from bubble cluster to the mock FAB */}
              <svg
                aria-hidden
                viewBox="0 0 200 200"
                className="absolute inset-0 h-full w-full pointer-events-none text-deep/40"
                fill="none"
              >
                <path
                  d="M 120 110 Q 170 130 178 168"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MockBubble({
  tone,
  text,
  className,
}: {
  tone: "mist" | "ink";
  text: string;
  className?: string;
}) {
  const surface =
    tone === "mist"
      ? "bg-mist text-ink"
      : "bg-ink text-white";
  return (
    <div
      className={`inline-flex max-w-[260px] items-center rounded-2xl px-4 py-2.5 text-[13.5px] shadow-md ${surface} ${className ?? ""}`}
    >
      {text}
    </div>
  );
}
