export default function QuickLinksPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Quick links</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Action shortcuts shown above the FAQ list (Documents, Bank, Vehicle, etc.).
          Editable like FAQ — same per-audience + per-language model.
        </p>
      </header>
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-10 text-center text-sm text-zinc-500">
        Coming next session — same shape as the FAQ editor with an{" "}
        <code className="bg-zinc-100 dark:bg-zinc-800 rounded px-1.5 py-0.5">action_href</code>{" "}
        deep-link instead of a long answer.
      </div>
    </div>
  );
}
