import { ArrowRight } from "lucide-react";
import InboxMockup from "../InboxMockup";
import PhoneMockup from "../PhoneMockup";

export default function Showcase() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 py-24">
      <div className="w-full max-w-7xl mx-auto">
        <div className="bg-deep rounded-[48px] border border-deep shadow-sm overflow-hidden">
          <div className="bg-mist bg-dotted rounded-[40px] m-2 shadow-sm">
            <div className="p-8 md:p-10 lg:p-12">
              <div className="max-w-2xl mx-auto text-center mb-10">
                <p className="text-[14px] font-medium text-deep/60">Showcase</p>
                <h2 className="mt-4 text-4xl sm:text-5xl tracking-tight text-ink leading-[1] font-normal">
                  One inbox.{" "}
                  <span className="font-serif-italic font-normal text-deep">
                    Every platform<span className="text-deep/40">.</span>
                  </span>
                </h2>
              </div>
              <div className="grid lg:grid-cols-[1.6fr_1fr] gap-6 lg:gap-10 items-center">
                <InboxMockup />
                <div className="justify-self-center">
                  <PhoneMockup />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom strip in deep blue */}
          <div className="px-6 sm:px-12 md:px-16 lg:px-20 py-5 flex flex-col md:flex-row justify-between items-center gap-6 text-[15px]">
            <p className="text-white/70 font-medium">
              One backend. Every platform.
            </p>
            <a
              href="#features"
              className="inline-flex items-center gap-2 text-white font-medium hover:text-mist transition-colors"
            >
              See all features
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
