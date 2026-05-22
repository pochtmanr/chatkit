"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Plus, RotateCcw, Trash2, UserPlus, X } from "lucide-react";
import {
  archiveAgent,
  inviteAgent,
  resendInvite,
  revokeInvite,
} from "@/app/dashboard/_actions/team";
import { setAgentSkills } from "@/app/dashboard/_actions/agent-profile";

type PendingInvite = {
  id: string;
  email: string;
  display_name: string;
  role: "agent" | "manager";
  created_at: string;
  expires_at: string;
};

type AgentRow = {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  role: "agent" | "manager";
  status: "online" | "away" | "offline";
  status_changed_at: string;
  accepted_at: string | null;
  is_self: boolean;
  skills: string[];
};

const SKILL_INPUT_MAX = 32;
const MAX_SKILLS_PER_AGENT = 16;

function normalizeSkillInput(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function SkillsEditor({
  agentId,
  initial,
  canEdit,
}: {
  agentId: string;
  initial: string[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [skills, setSkills] = useState<string[]>(initial);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function persist(next: string[]) {
    setSkills(next);
    setError(null);
    startTransition(async () => {
      const res = await setAgentSkills({ agentId, skills: next });
      if (!res.ok) {
        setError(res.error);
        setSkills(initial);
        return;
      }
      router.refresh();
    });
  }

  function add() {
    const slug = normalizeSkillInput(draft);
    if (!slug) return;
    if (skills.includes(slug)) {
      setDraft("");
      return;
    }
    if (skills.length >= MAX_SKILLS_PER_AGENT) {
      setError(`at most ${MAX_SKILLS_PER_AGENT} skills per agent`);
      return;
    }
    setDraft("");
    persist([...skills, slug]);
  }

  function remove(slug: string) {
    persist(skills.filter((s) => s !== slug));
  }

  if (!canEdit && skills.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {skills.map((s) => (
        <span
          key={s}
          className="inline-flex items-center gap-1 rounded-full bg-mist/60 text-deep px-2 py-0.5 text-[11.5px] font-medium"
        >
          {s}
          {canEdit && (
            <button
              type="button"
              onClick={() => remove(s)}
              disabled={pending}
              aria-label={`Remove skill ${s}`}
              className="rounded-full p-0.5 hover:bg-mist/80 disabled:opacity-50"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </span>
      ))}
      {canEdit && (
        <form
          className="inline-flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, SKILL_INPUT_MAX))}
            placeholder="add skill"
            maxLength={SKILL_INPUT_MAX}
            disabled={pending || skills.length >= MAX_SKILLS_PER_AGENT}
            className="rounded-full border border-mist bg-white px-2.5 py-0.5 text-[11.5px] text-ink placeholder:text-deep/40 focus:outline-none focus:ring-1 focus:ring-ink/20 disabled:opacity-50 w-[110px]"
          />
          <button
            type="submit"
            disabled={pending || !draft.trim()}
            aria-label="Add skill"
            className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-ink text-white hover:bg-deep transition-colors disabled:opacity-50"
          >
            <Plus className="h-2.5 w-2.5" />
          </button>
        </form>
      )}
      {error && (
        <span className="text-[11px] text-red-700 ml-1" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) {
    return formatFuture(-ms);
  }
  const min = Math.round(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatFuture(ms: number): string {
  const min = Math.round(ms / 60_000);
  if (min < 60) return `in ${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `in ${hr}h`;
  const day = Math.round(hr / 24);
  return `in ${day}d`;
}

function StatusDot({ status }: { status: AgentRow["status"] }) {
  const color =
    status === "online"
      ? "bg-emerald-500"
      : status === "away"
        ? "bg-amber-400"
        : "bg-deep/30";
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${color}`}
      aria-label={status}
    />
  );
}

function AgentAvatar({
  url,
  name,
}: {
  url: string | null;
  name: string;
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="h-9 w-9 rounded-full object-cover border border-mist"
      />
    );
  }
  const initial = (name.trim().charAt(0) || "?").toUpperCase();
  return (
    <div className="h-9 w-9 rounded-full bg-mist/60 border border-mist grid place-items-center text-[13px] font-medium text-deep">
      {initial}
    </div>
  );
}

function InviteDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"agent" | "manager">("agent");

  if (!open) return null;

  function close() {
    setError(null);
    setEmail("");
    setDisplayName("");
    setRole("agent");
    onClose();
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("email", email);
      fd.append("displayName", displayName);
      fd.append("role", role);
      const res = await inviteAgent(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
      close();
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-4">
      <div className="max-w-md w-full rounded-2xl bg-white border border-mist p-6 space-y-5">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[12px] uppercase tracking-[0.1em] text-deep/50">
              Invite agent
            </p>
            <h2 className="text-[18px] font-semibold text-ink">
              Send a Chatkit invite
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="p-1 rounded-full hover:bg-mist/40 text-deep/60"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <label className="block text-[12px] uppercase tracking-[0.1em] text-deep/60">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full rounded-xl border border-mist bg-white px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
              placeholder="agent@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[12px] uppercase tracking-[0.1em] text-deep/60">
              Display name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={80}
              required
              className="w-full rounded-xl border border-mist bg-white px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
              placeholder="What customers will see"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[12px] uppercase tracking-[0.1em] text-deep/60">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "agent" | "manager")}
              className="w-full rounded-xl border border-mist bg-white px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
            >
              <option value="agent">Agent — handles the queue</option>
              <option value="manager">Manager — invites teammates and sees the timeline</option>
            </select>
          </div>

          {error && (
            <p className="text-[13px] font-medium text-red-700">{error}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={close}
              className="rounded-full px-4 py-2 text-[14px] font-medium text-deep hover:bg-mist/40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-full bg-ink text-white px-4 py-2 text-[14px] font-medium hover:bg-deep transition-colors disabled:opacity-60"
            >
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Send invite
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function TeamSettings({
  businessName,
  ownerEmail,
  pending,
  agents,
  callerRole,
}: {
  businessName: string;
  ownerEmail: string | null;
  pending: PendingInvite[];
  agents: AgentRow[];
  callerRole: "owner" | "manager" | "agent";
}) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transition, startTransition] = useTransition();

  const canArchive = callerRole === "owner" || callerRole === "manager";
  const canEditSkills = callerRole === "owner" || callerRole === "manager";

  function runAction(id: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setPendingId(id);
    setError(null);
    startTransition(async () => {
      const res = await fn();
      setPendingId(null);
      if (!res.ok) {
        setError(res.error ?? "Action failed");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-white border border-mist/80 p-6 md:p-8 space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
              Support agents
            </p>
            <h2 className="text-[18px] font-semibold text-ink mt-1">
              Team for {businessName}
            </h2>
            <p className="text-[13px] text-deep/70 mt-1 max-w-2xl">
              Invite teammates to work the inbox. Agents see the queue;
              managers also invite and archive teammates and see the
              team timeline.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-ink text-white px-4 py-2 text-[14px] font-medium hover:bg-deep transition-colors"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Invite agent
          </button>
        </div>
        {error && (
          <p className="text-[13px] font-medium text-red-700">{error}</p>
        )}
      </section>

      <section className="rounded-2xl bg-white border border-mist/80 overflow-hidden">
        <header className="px-6 py-4 border-b border-mist/80">
          <p className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
            Pending invites
          </p>
        </header>
        {pending.length === 0 ? (
          <div className="px-6 py-8 text-[13px] text-deep/60">
            No outstanding invites.
          </div>
        ) : (
          <ul className="divide-y divide-mist/70">
            {pending.map((inv) => {
              const busy = pendingId === inv.id && transition;
              return (
                <li
                  key={inv.id}
                  className="px-6 py-4 flex flex-wrap items-center gap-4"
                >
                  <Mail className="h-4 w-4 text-deep/60 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] text-ink truncate">{inv.email}</p>
                    <p className="text-[12px] text-deep/60">
                      {inv.display_name} · {inv.role} · invited{" "}
                      {formatRelative(inv.created_at)} · expires{" "}
                      {formatRelative(inv.expires_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        runAction(inv.id, () => resendInvite(inv.id))
                      }
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-deep hover:bg-mist/40 disabled:opacity-60"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Resend
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (!confirm(`Revoke the invite for ${inv.email}?`)) return;
                        runAction(inv.id, () => revokeInvite(inv.id));
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Revoke
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl bg-white border border-mist/80 overflow-hidden">
        <header className="px-6 py-4 border-b border-mist/80">
          <p className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
            Active agents
          </p>
        </header>
        <ul className="divide-y divide-mist/70">
          {ownerEmail && (
            <li className="px-6 py-4 flex flex-wrap items-center gap-4">
              <AgentAvatar url={null} name={ownerEmail} />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] text-ink truncate">
                  {ownerEmail}{" "}
                  <span className="text-[12px] text-deep/60">(you)</span>
                </p>
                <p className="text-[12px] text-deep/60">
                  Admin · full access
                </p>
              </div>
            </li>
          )}
          {agents.length === 0 ? (
            <li className="px-6 py-8 text-[13px] text-deep/60">
              No agents yet — invite someone above.
            </li>
          ) : (
            agents.map((a) => {
              const busy = pendingId === a.id && transition;
              return (
                <li
                  key={a.id}
                  className="px-6 py-4 flex flex-wrap items-start gap-4"
                >
                  <AgentAvatar url={a.avatar_url} name={a.display_name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] text-ink truncate flex items-center gap-2">
                      {a.display_name}
                      {a.is_self && (
                        <span className="text-[12px] text-deep/60">(you)</span>
                      )}
                    </p>
                    <p className="text-[12px] text-deep/60 flex items-center gap-2">
                      <StatusDot status={a.status} />
                      <span className="capitalize">{a.status}</span>
                      <span>·</span>
                      <span>{a.email}</span>
                      <span>·</span>
                      <span className="capitalize">{a.role}</span>
                      {a.accepted_at && (
                        <>
                          <span>·</span>
                          <span>joined {formatRelative(a.accepted_at)}</span>
                        </>
                      )}
                    </p>
                    <SkillsEditor
                      agentId={a.id}
                      initial={a.skills}
                      canEdit={canEditSkills}
                    />
                  </div>
                  {!a.is_self && canArchive && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (
                          !confirm(
                            `Archive ${a.display_name}? They lose access immediately.`,
                          )
                        )
                          return;
                        runAction(a.id, () => archiveAgent(a.id));
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Archive
                    </button>
                  )}
                </li>
              );
            })
          )}
        </ul>
      </section>

      <p className="text-[13px] text-deep/60">
        Need to set up multiple inboxes?{" "}
        <Link
          href="/dashboard/settings/business"
          className="text-deep underline hover:text-ink"
        >
          Visit Settings → Inboxes
        </Link>
        .
      </p>

      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
