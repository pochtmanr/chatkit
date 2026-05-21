import { Quote } from "lucide-react";

export default function Testimonials() {
  return (
    <section className="w-full bg-deep py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-2xl mb-12">
          <p className="text-[14px] font-medium text-white/60">Testimonials</p>
          <h2 className="mt-4 text-4xl sm:text-5xl tracking-tight text-white leading-[1] font-normal">
            Devs who shipped support{" "}
            <span className="font-serif-italic font-normal text-mist">
              in an afternoon<span className="text-white/40">.</span>
            </span>
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="rounded-2xl border border-white/10 bg-white shadow-[0_8px_24px_rgba(11,11,11,0.12)] p-6 flex flex-col"
            >
              <Quote className="h-6 w-6 text-deep/30" />
              <p className="mt-4 text-deep leading-relaxed text-sm">
                {t.quote}
              </p>
              <div className="mt-6 flex items-center gap-3 pt-4 border-t border-mist">
                <div
                  aria-hidden
                  className="grid place-items-center h-10 w-10 rounded-full bg-ink text-white text-xs"
                >
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm text-ink">{t.name}</p>
                  <p className="text-xs text-deep/60">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// placeholder copy — swap with real quotes when collected
const TESTIMONIALS = [
  {
    initials: "MK",
    name: "Maya Kowalski",
    role: "Engineer at GoDelivery",
    quote:
      "We replaced a half-built Zendesk integration with ChatKit in one afternoon. Our drivers and customers talk through it now and we never touched the backend.",
  },
  {
    initials: "DR",
    name: "Dev Rao",
    role: "Founder, Curbside",
    quote:
      "The React Native package is the cleanest support SDK I've ever shipped. Three props and it just works on iOS and Android.",
  },
  {
    initials: "SH",
    name: "Sofia Hernandez",
    role: "CTO at LocalEats",
    quote:
      "We embed their inbox inside our existing admin via the JWT iframe. Our ops team didn't have to learn a new tool.",
  },
];
