import type { ReactNode } from "react";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

const METHOD_BG: Record<HttpMethod, string> = {
  GET: "bg-emerald-500",
  POST: "bg-ink",
  PATCH: "bg-deep",
  DELETE: "bg-red-600",
};

export function MethodPill({ method }: { method: HttpMethod }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wider text-white font-mono ${METHOD_BG[method]}`}
    >
      {method}
    </span>
  );
}

export function EndpointCard(props: {
  id: string;
  method: HttpMethod;
  path: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      id={props.id}
      className="scroll-mt-24 rounded-[2rem] border border-mist bg-white p-6 md:p-8 shadow-sm"
    >
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <MethodPill method={props.method} />
          <code className="font-mono text-[15px] sm:text-[16px] text-ink break-all">
            {props.path}
          </code>
        </div>
        <h3 className="text-2xl sm:text-[28px] tracking-tight text-ink leading-tight font-normal">
          {props.title}
        </h3>
        <p className="text-deep/70 leading-relaxed text-[15px]">
          {props.description}
        </p>
      </header>
      <div className="mt-6 space-y-6">{props.children}</div>
    </section>
  );
}

export function SubHead({ children }: { children: ReactNode }) {
  return (
    <h4 className="text-xs uppercase tracking-[0.18em] text-zinc-600">
      {children}
    </h4>
  );
}
