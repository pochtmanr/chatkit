import type { listInvoices } from "@/app/dashboard/_actions/billing";

type Invoices = Awaited<ReturnType<typeof listInvoices>>;

export function InvoicesTable({ invoices }: { invoices: Invoices }) {
  return (
    <section className="rounded-2xl bg-white border border-mist/80 overflow-hidden">
      <header className="px-5 py-4 border-b border-mist">
        <h2 className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
          Invoices
        </h2>
      </header>
      <table className="w-full text-left text-[14px]">
        <thead className="bg-white border-b border-mist">
          <tr className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
            <th className="px-5 py-2.5">Date</th>
            <th className="px-5 py-2.5">Plan</th>
            <th className="px-5 py-2.5">Period</th>
            <th className="px-5 py-2.5 text-right">Amount</th>
            <th className="px-5 py-2.5">Status</th>
            <th className="px-5 py-2.5"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-mist">
          {invoices.map((inv) => (
            <tr key={inv.id}>
              <td className="px-5 py-3 text-deep/80">
                {new Date(inv.created_at).toLocaleDateString()}
              </td>
              <td className="px-5 py-3 text-ink capitalize">{inv.plan_id}</td>
              <td className="px-5 py-3 text-deep/80">
                {inv.period_start} → {inv.period_end}
              </td>
              <td className="px-5 py-3 text-right text-ink tabular-nums">
                £{(inv.amount_cents / 100).toFixed(2)}
              </td>
              <td className="px-5 py-3">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-medium ${statusClass(inv.status)}`}
                >
                  {inv.status}
                </span>
              </td>
              <td className="px-5 py-3 text-right">
                {inv.hosted_invoice_url ? (
                  <a
                    href={inv.hosted_invoice_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[13px] font-medium text-deep hover:text-ink"
                  >
                    Receipt
                  </a>
                ) : null}
              </td>
            </tr>
          ))}
          {invoices.length === 0 && (
            <tr>
              <td colSpan={6} className="px-5 py-6 text-[13px] text-deep/60">
                No invoices yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

function statusClass(s: string): string {
  switch (s) {
    case "paid":
      return "bg-emerald-50 text-emerald-800 border border-emerald-200";
    case "open":
      return "bg-amber-50 text-amber-800 border border-amber-200";
    case "draft":
      return "bg-mist text-deep/60 border border-mist";
    case "failed":
      return "bg-rose-50 text-rose-800 border border-rose-200";
    case "refunded":
      return "bg-indigo-50 text-indigo-800 border border-indigo-200";
    default:
      return "bg-mist text-deep/60 border border-mist";
  }
}
