import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Grainient from "../Grainient";

export default function Hero() {
  return (
    <section className="relative bg-white pt-20 sm:pt-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-dotted-mist [mask-image:radial-gradient(ellipse_60%_70%_at_center,_black_0%,_transparent_85%)] [-webkit-mask-image:radial-gradient(ellipse_60%_70%_at_center,_black_0%,_transparent_85%)]"
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pb-6 sm:pb-8">
        <div className="mt-4 sm:mt-6 bg-deep rounded-[3rem] shadow-xl overflow-hidden">
          <div className="relative isolate m-2 rounded-[2.75rem] overflow-hidden min-h-[calc(100dvh-14rem)] sm:min-h-[calc(100dvh-16rem)]">
            <div className="absolute inset-0 z-0">
              <Grainient
                color1="#E4E4E4"
                color2="#2B4559"
                color3="#E4E4E4"
                timeSpeed={1.2}
                colorBalance={0.0}
                warpStrength={0.4}
                warpFrequency={7.9}
                warpSpeed={0.4}
                warpAmplitude={13}
                blendAngle={-25}
                blendSoftness={0.55}
                rotationAmount={500.0}
                noiseScale={2.0}
                grainAmount={0.1}
                grainScale={2.0}
                grainAnimated={false}
                contrast={1.5}
                gamma={1.0}
                saturation={1.0}
                centerX={0.0}
                centerY={0.0}
                zoom={0.4}
              />
            </div>

            <div
              aria-hidden
              className="absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.7)_0%,_rgba(255,255,255,0.3)_45%,_transparent_78%)]"
            />

            <ChatBubble
            tone="mist"
            text="Where's my order? 🚚"
            className="absolute left-[14%] top-[18%] hero-float-a -rotate-3"
          />
          <ChatBubble
            tone="mist"
            text="Can I change my address?"
            className="hidden sm:flex absolute right-[16%] top-[14%] hero-float-b rotate-2"
          />
          <ChatBubble
            tone="mist"
            text="Driver hasn't moved in 20 min"
            className="hidden md:flex absolute left-[6%] top-[46%] hero-float-c -rotate-2"
          />
          <ChatBubble
            tone="mist"
            text="Need a copy of the invoice"
            className="hidden lg:flex absolute right-[8%] top-[42%] hero-float-a rotate-3"
          />
          <ChatBubble
            tone="ink"
            text="Refund sent — done ✓"
            className="absolute right-[14%] bottom-[20%] hero-float-b rotate-2"
          />
          <ChatBubble
            tone="ink"
            text="Looking into it now"
            className="hidden sm:flex absolute left-[12%] bottom-[24%] hero-float-c -rotate-1"
          />
          <ChatBubble
            tone="mist"
            text="Thanks! Got it 🙌"
            className="hidden md:flex absolute right-[34%] bottom-[14%] hero-float-a rotate-1"
          />
          <TypingBubble className="hidden md:flex absolute left-[36%] top-[26%] -rotate-2" />

          <div className="relative z-10 min-h-[calc(100dvh-9rem)] sm:min-h-[calc(100dvh-10rem)] flex flex-col items-center justify-center px-6 pt-24 pb-16 sm:pt-28 sm:pb-20">
            <div className="max-w-3xl text-center">
              <h1 className="text-ink leading-[0.95] text-[clamp(2.75rem,6vw,5.5rem)] tracking-tight font-normal">
                Customer chat.
                <br />
                <span className="font-serif-italic text-deep">
                  Built into your code<span className="text-zinc-400">.</span>
                </span>
              </h1>

              <div className="mt-9 inline-flex items-center gap-2 rounded-full bg-white/85 backdrop-blur-sm border border-zinc-200/80 shadow-sm px-3.5 py-1.5 text-[11px] uppercase tracking-[0.18em] text-zinc-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                From $0/mo
                <span className="text-zinc-300">·</span>
                No credit card
              </div>

              <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/login"
                  className="group inline-flex items-center gap-2 rounded-full bg-ink text-white pl-5 pr-2 py-2 text-[15px] shadow-lg shadow-ink/10 hover:bg-deep transition-colors"
                >
                  Start building
                  <span className="grid place-items-center h-7 w-7 rounded-full bg-white text-ink transition-transform group-hover:translate-x-0.5">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
                <Link
                  href="#pricing"
                  className="inline-flex items-center gap-2 rounded-full bg-white/90 backdrop-blur-sm border border-zinc-200/80 px-5 py-2.5 text-[15px] text-ink shadow-sm hover:bg-white transition-colors"
                >
                  See pricing
                </Link>
              </div>

            </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ChatBubble({
  tone,
  text,
  className = "",
}: {
  tone: "mist" | "ink";
  text: string;
  className?: string;
}) {
  const base =
    "max-w-[15rem] px-4 py-2.5 text-sm shadow-xl backdrop-blur-sm ring-1 z-[2]";
  const styles =
    tone === "mist"
      ? "rounded-2xl rounded-tl-md bg-mist/95 text-zinc-800 ring-zinc-200/60"
      : "rounded-2xl rounded-tr-md bg-ink text-white ring-black/10";

  return (
    <div className={`${base} ${styles} ${className}`}>
      <p className="leading-snug">{text}</p>
    </div>
  );
}

function TypingBubble({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl rounded-tl-md bg-white/95 backdrop-blur-sm ring-1 ring-zinc-200/60 shadow-xl px-4 py-3 z-[2] ${className}`}
    >
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-zinc-400 hero-typing-dot" />
        <span className="h-2 w-2 rounded-full bg-zinc-400 hero-typing-dot hero-typing-dot-2" />
        <span className="h-2 w-2 rounded-full bg-zinc-400 hero-typing-dot hero-typing-dot-3" />
      </div>
    </div>
  );
}
