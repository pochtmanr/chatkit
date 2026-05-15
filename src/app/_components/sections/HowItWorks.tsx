import { MessageSquare, ShieldCheck, Webhook } from "lucide-react";

export default function HowItWorks() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 py-24">
      <div className="max-w-2xl mb-12">
        <p className="text-[14px] font-medium text-deep/60">How it works</p>
        <h2 className="mt-4 text-4xl sm:text-5xl tracking-tight text-ink leading-[1] font-normal">
          From paste to{" "}
          <span className="font-serif-italic font-normal text-deep">
            first ticket<span className="text-deep/40">.</span>
          </span>
        </h2>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {STEPS.map((s) => (
          <div
            key={s.n}
            className="relative rounded-[2rem] border border-mist bg-white shadow-[0_1px_2px_rgba(11,11,11,0.04)] p-8 overflow-hidden"
          >
            <span
              aria-hidden
              className="absolute top-3 right-6 font-serif-italic text-7xl text-mist select-none pointer-events-none"
            >
              {s.n}
            </span>
            <div className="grid place-items-center h-10 w-10 rounded-[10px] bg-mist/40 border border-mist text-deep">
              <s.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-6 text-ink text-[18px]">{s.title}</h3>
            <p className="mt-2 text-[15px] text-deep/70 leading-relaxed">
              {s.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

const STEPS = [
  {
    n: "01",
    icon: Webhook,
    title: "Install the SDK",
    body: "One package for web, one for React Native. No backend setup, no migrations to run.",
  },
  {
    n: "02",
    icon: ShieldCheck,
    title: "Drop in your API key",
    body: "One env var, then mount the widget. It appears on every platform automatically.",
  },
  {
    n: "03",
    icon: MessageSquare,
    title: "Reply from one inbox",
    body: "Use our dashboard or embed it inside your existing admin. Email fallback when nobody is online.",
  },
];
