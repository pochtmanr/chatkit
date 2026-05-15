import type { ReactNode } from "react";
import { SubHead } from "./EndpointCard";

export type ParamRow = {
  name: string;
  type: string;
  required?: boolean;
  description: ReactNode;
};

export function ParamTable({
  title,
  rows,
}: {
  title: string;
  rows: ParamRow[];
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <SubHead>{title}</SubHead>
      <div className="mt-3 overflow-hidden rounded-2xl border border-mist">
        <table className="w-full text-left text-[14px]">
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.name}
                className={
                  idx === 0
                    ? "align-top"
                    : "align-top border-t border-mist"
                }
              >
                <td className="px-4 py-3 w-[40%] sm:w-[32%]">
                  <code className="font-mono text-[13px] text-ink break-all">
                    {row.name}
                  </code>
                  <div className="mt-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em]">
                    <span className="text-deep/60">{row.type}</span>
                    {row.required ? (
                      <span className="text-red-600/80 font-medium">
                        required
                      </span>
                    ) : (
                      <span className="text-deep/40">optional</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-deep/80 leading-relaxed">
                  {row.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
