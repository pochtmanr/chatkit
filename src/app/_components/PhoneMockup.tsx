import { MessageSquare, Smile } from "lucide-react";

export default function PhoneMockup() {
  return (
    <div className="relative rounded-[2.25rem] border-[10px] border-ink bg-zinc-50 w-[240px] h-[480px] shadow-xl overflow-hidden">
      {/* notch */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 h-5 w-20 rounded-full bg-ink z-10" />
      {/* app content placeholder */}
      <div className="absolute inset-0 p-3 pt-10 flex flex-col gap-2">
        <div className="h-3 w-2/3 rounded-full bg-zinc-200" />
        <div className="h-20 rounded-xl bg-zinc-200/60" />
        <div className="h-3 w-1/2 rounded-full bg-zinc-200" />
        <div className="grid grid-cols-2 gap-2 mt-1">
          <div className="h-14 rounded-lg bg-zinc-200/60" />
          <div className="h-14 rounded-lg bg-zinc-200/60" />
        </div>
        <div className="h-3 w-1/3 rounded-full bg-zinc-200" />
        <div className="h-28 rounded-xl bg-zinc-200/60" />
      </div>
      {/* widget bubble */}
      <div className="absolute bottom-4 right-3 grid place-items-center h-12 w-12 rounded-full bg-ink text-white shadow-lg z-10">
        <MessageSquare className="h-5 w-5" />
        <span className="absolute -top-1 -right-1 grid place-items-center h-4 w-4 rounded-full bg-white text-ink text-[9px] border-2 border-ink">
          2
        </span>
      </div>
      {/* widget panel preview */}
      <div className="absolute bottom-20 right-3 left-3 rounded-2xl bg-white border border-zinc-200 shadow-xl p-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="grid place-items-center h-6 w-6 rounded-full bg-ink text-white">
            <Smile className="h-3 w-3" />
          </div>
          <p className="text-[10px] text-ink">Support</p>
        </div>
        <p className="rounded-lg bg-mist px-2 py-1.5 text-[10px] text-zinc-800 leading-snug">
          Hey! Anything I can help with?
        </p>
      </div>
    </div>
  );
}
