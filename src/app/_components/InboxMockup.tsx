import { Search, Paperclip, Send } from "lucide-react";

export default function InboxMockup() {
  return (
    <div className="rounded-2xl bg-white shadow-xl border border-zinc-200 overflow-hidden">
      {/* window chrome */}
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-zinc-100">
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
        <span className="ml-3 text-xs text-zinc-400 font-mono">tinychat.app/inbox</span>
      </div>
      <div className="grid grid-cols-[200px_1fr] sm:grid-cols-[240px_1fr] min-h-[320px]">
        {/* conv list */}
        <div className="border-r border-zinc-100 bg-zinc-50/60">
          <div className="px-4 py-3 border-b border-zinc-100 flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-xs text-zinc-400">Search</span>
          </div>
          <ul>
            {INBOX_ROWS.map((row, i) => (
              <li
                key={row.name}
                className={`flex items-start gap-3 px-4 py-3 border-b border-zinc-100 ${
                  i === 0 ? "bg-white" : ""
                }`}
              >
                <div
                  aria-hidden
                  className="shrink-0 grid place-items-center h-8 w-8 rounded-full bg-ink text-white text-[10px]"
                >
                  {row.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-ink truncate">{row.name}</p>
                    <span className="text-[10px] text-zinc-400 shrink-0">
                      {row.time}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 truncate mt-0.5">
                    {row.snippet}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        {/* thread */}
        <div className="flex flex-col">
          <div className="px-5 py-3 border-b border-zinc-100 flex items-center gap-3">
            <div
              aria-hidden
              className="grid place-items-center h-7 w-7 rounded-full bg-ink text-white text-[10px]"
            >
              AM
            </div>
            <div>
              <p className="text-xs text-ink">Ali Mansoor</p>
              <p className="text-[10px] text-zinc-400">Order #4821 · Active now</p>
            </div>
          </div>
          <div className="flex-1 px-5 py-5 space-y-3 bg-white">
            <div className="flex justify-start">
              <p className="max-w-[80%] rounded-2xl rounded-tl-md bg-mist px-3 py-2 text-xs text-zinc-800">
                Hey, my order is showing delivered but I never got it.
              </p>
            </div>
            <div className="flex justify-start">
              <p className="max-w-[80%] rounded-2xl rounded-tl-md bg-mist px-3 py-2 text-xs text-zinc-800">
                The driver said they left it at the door.
              </p>
            </div>
            <div className="flex justify-end">
              <p className="max-w-[80%] rounded-2xl rounded-tr-md bg-ink text-white px-3 py-2 text-xs">
                Looking into it now — sending you a refund within 5 min.
              </p>
            </div>
          </div>
          <div className="px-4 py-3 border-t border-zinc-100 flex items-center gap-2">
            <Paperclip className="h-3.5 w-3.5 text-zinc-400" />
            <div className="flex-1 rounded-lg bg-zinc-50 border border-zinc-100 px-3 py-1.5 text-xs text-zinc-400">
              Reply…
            </div>
            <button
              aria-hidden
              className="grid place-items-center h-7 w-7 rounded-md bg-ink text-white"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const INBOX_ROWS = [
  { name: "Ali Mansoor", initials: "AM", snippet: "Order showing delivered but…", time: "2m" },
  { name: "Priya Shah", initials: "PS", snippet: "Can I change my address?", time: "12m" },
  { name: "Marcus Reed", initials: "MR", snippet: "Driver hasn't moved in 20…", time: "1h" },
  { name: "Lina Park", initials: "LP", snippet: "Refund request — thanks!", time: "3h" },
];
