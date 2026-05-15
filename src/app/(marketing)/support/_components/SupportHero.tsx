export function SupportHero() {
  return (
    <section className="relative bg-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-dotted-mist [mask-image:radial-gradient(ellipse_60%_70%_at_center,_black_0%,_transparent_85%)] [-webkit-mask-image:radial-gradient(ellipse_60%_70%_at_center,_black_0%,_transparent_85%)]"
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-28 sm:pt-32 pb-12 sm:pb-16">
        <div className="max-w-3xl">
          <p className="text-[14px] font-medium text-deep/60">Support</p>
          <h1 className="mt-4 text-4xl sm:text-6xl tracking-tight text-ink leading-[1] font-normal">
            Help is{" "}
            <span className="font-serif-italic text-deep">
              right here<span className="text-deep/40">.</span>
            </span>
          </h1>
          <p className="mt-5 text-deep/70 leading-relaxed text-[16px] max-w-[560px]">
            Tap the red bubble in the bottom-right — yes, that&apos;s our own
            widget, running our own inbox. Or skim the quick links below first.
          </p>
        </div>
      </div>
    </section>
  );
}
