import { MessageSquare, ShieldCheck, Webhook, Globe } from "lucide-react";

export default function Features() {
  return (
    <section id="features" className="w-full bg-mist py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-2xl mb-12">
          <p className="text-[14px] font-medium text-deep/60">Features</p>
          <h2 className="mt-4 text-4xl sm:text-5xl tracking-tight text-ink leading-[1] font-normal">
            Everything you need,{" "}
            <span className="font-serif-italic font-normal text-deep">
              nothing extra<span className="text-deep/40">.</span>
            </span>
          </h2>
          <p className="mt-4 text-deep/70 leading-relaxed text-[16px] font-normal">
            Order chat, support inbox, webhooks, email — one backend, every
            platform.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => {
            const span =
              i === 1 || i === 2 ? "lg:col-span-2" : "lg:col-span-1";
            return (
              <div
                key={f.title}
                className={`${span} group relative rounded-[2rem] bg-white shadow-[0_1px_2px_rgba(11,11,11,0.04)] hover:shadow-[0_16px_40px_rgba(11,11,11,0.2)] p-8 flex flex-col overflow-hidden transition-shadow duration-300`}
              >
                <div className="relative">
                  <div className="grid place-items-center h-10 w-10 rounded-[10px] bg-deep/10 text-deep transition-colors duration-500 ease-out group-hover:bg-white group-hover:text-deep group-hover:shadow-sm">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-6 text-[18px] text-ink">{f.title}</h3>
                  <p className="mt-2 text-[15px] text-deep/70 leading-relaxed">
                    {f.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  {
    icon: MessageSquare,
    title: "Order chat",
    body: "Customer ↔ driver group chat per order. Real-time, with typing and read receipts.",
  },
  {
    icon: ShieldCheck,
    title: "Support inbox",
    body: "1:1 chat between users and your admins. Email fallback when nobody's online.",
  },
  {
    icon: Webhook,
    title: "Webhook + email",
    body: "Push events come through your webhook so you keep control of FCM. Email is on us.",
  },
  {
    icon: Globe,
    title: "Web + iOS + Android",
    body: "Drop-in widgets for Next.js, React Native, and Expo. One backend.",
  },
];
