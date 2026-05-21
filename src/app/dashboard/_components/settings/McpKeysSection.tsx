"use client";

import { useState, useTransition } from "react";
import { Copy, Check, Trash2, KeyRound } from "lucide-react";
import {
  createMcpKey,
  revokeMcpKey,
} from "@/app/dashboard/_actions/mcp-keys";

type Key = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export function McpKeysSection({
  keys,
  canManage,
}: {
  keys: Key[];
  canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<{ raw: string; prefix: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  function onCreate() {
    setError(null);
    startTransition(async () => {
      const res = await createMcpKey({ name });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNewKey({ raw: res.rawKey, prefix: res.prefix });
      setShowCreate(false);
      setName("");
    });
  }

  function onCopy() {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey.raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function onRevoke(id: string) {
    if (
      !confirm(
        "Revoke this key? Any tool using it will stop working immediately.",
      )
    )
      return;
    startTransition(async () => {
      const res = await revokeMcpKey(id);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-white border border-mist/80 p-6 md:p-8 space-y-3">
        <h2 className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
          MCP access keys
        </h2>
        <p className="text-[14px] text-deep/70 max-w-3xl">
          Use these with the{" "}
          <code className="text-ink">@holylabs/chatkit-mcp</code> npm package to
          connect tools like Claude Code, Claude Desktop, or Cursor to your
          conversations. Treat each key like a password — it gives full
          read/write access to this business.
        </p>
        {canManage && !showCreate && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-full bg-ink text-white px-4 py-2 text-[14px] font-medium hover:bg-deep transition-colors"
          >
            <KeyRound className="h-3.5 w-3.5" />
            New key
          </button>
        )}
        {showCreate && (
          <div className="rounded-2xl border border-mist bg-mist/20 p-4 flex flex-col md:flex-row gap-3 items-end">
            <label className="block flex-1 w-full">
              <span className="text-[13px] font-medium text-deep/70">
                Key name
              </span>
              <input
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='e.g. "My laptop"'
                maxLength={60}
                className="mt-1.5 w-full rounded-xl border border-mist bg-white px-4 py-3 text-[15px] text-ink placeholder:text-deep/30 shadow-[0_1px_2px_rgba(11,11,11,0.03)] focus:outline-none focus:border-deep/40 focus:ring-2 focus:ring-deep/10 transition-all"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setName("");
                }}
                className="rounded-full bg-white border border-mist px-4 py-2 text-[14px] font-medium text-ink hover:bg-mist/40 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onCreate}
                disabled={pending || !name.trim()}
                className="rounded-full bg-ink text-white px-5 py-2 text-[14px] font-medium hover:bg-deep transition-colors disabled:opacity-60"
              >
                Create key
              </button>
            </div>
          </div>
        )}
        {error && <p className="text-[13px] text-red-700">{error}</p>}
      </section>

      {newKey && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 space-y-3">
          <h3 className="text-[14px] font-medium text-emerald-900">
            Copy this key now
          </h3>
          <p className="text-[13px] text-emerald-800/80">
            This is the only time it&apos;s shown in full. Store it in a password
            manager. If you lose it, revoke it and create a new one.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-xl bg-ink text-white/90 font-mono text-[13px] px-4 py-3 overflow-x-auto">
              {newKey.raw}
            </code>
            <button
              type="button"
              onClick={onCopy}
              className="rounded-full bg-white border border-mist px-4 py-2 text-[14px] font-medium text-ink hover:bg-mist/40 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 inline mr-1" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 inline mr-1" />
                  Copy
                </>
              )}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setNewKey(null)}
            className="text-[13px] font-medium text-deep/70 hover:text-ink"
          >
            I&apos;ve stored it — hide
          </button>
        </section>
      )}

      <section className="rounded-2xl bg-white border border-mist/80 overflow-hidden">
        <table className="w-full text-left text-[14px]">
          <thead className="bg-white border-b border-mist">
            <tr className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
              <th className="px-5 py-2.5">Name</th>
              <th className="px-5 py-2.5">Prefix</th>
              <th className="px-5 py-2.5">Created</th>
              <th className="px-5 py-2.5">Last used</th>
              <th className="px-5 py-2.5">Status</th>
              <th className="px-5 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mist">
            {keys.map((k) => (
              <tr key={k.id}>
                <td className="px-5 py-3 text-ink">{k.name}</td>
                <td className="px-5 py-3 font-mono text-[12px] text-deep/70">
                  {k.prefix}…
                </td>
                <td className="px-5 py-3 text-deep/70">
                  {new Date(k.createdAt).toLocaleDateString()}
                </td>
                <td className="px-5 py-3 text-deep/70">
                  {k.lastUsedAt
                    ? new Date(k.lastUsedAt).toLocaleString()
                    : "Never"}
                </td>
                <td className="px-5 py-3">
                  {k.revokedAt ? (
                    <span className="inline-flex items-center rounded-full bg-mist text-deep/60 border border-mist px-2 py-0.5 text-[12px]">
                      Revoked
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[12px]">
                      Active
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  {canManage && !k.revokedAt && (
                    <button
                      type="button"
                      onClick={() => onRevoke(k.id)}
                      disabled={pending}
                      className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[12px] font-medium text-red-700 hover:bg-red-100 transition-colors disabled:opacity-60"
                    >
                      <Trash2 className="h-3 w-3" />
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {keys.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-6 text-[13px] text-deep/60"
                >
                  No keys yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
