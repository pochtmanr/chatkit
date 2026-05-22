"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, ChevronDown, LogOut, UserCog } from "lucide-react";
import { logoutAction } from "@/app/(auth)/actions";
import { setActiveBusiness, setActiveInbox } from "@/app/dashboard/_actions/active-context";
import { setStatus, type AgentStatus } from "../_actions/presence";
import { getOwnTimeline, type OwnTimeline } from "../_actions/sessions";
import { AgentTimelineStrip } from "./AgentTimelineStrip";

type RoleLabel = "Admin" | "Manager" | "Agent";

type BusinessOption = {
  id: string;
  name: string;
  logoUrl: string | null;
  planLabel: string;
};

type InboxOption = {
  id: string;
  name: string;
};

type Props = {
  displayName: string;
  email: string;
  avatarUrl: string | null;
  roleLabel: RoleLabel;
  hasAgentRow: boolean;
  initialStatus: AgentStatus;
  skills: string[];
  activeBusinessId: string;
  businesses: BusinessOption[];
  activeInboxId: string | null;
  inboxes: InboxOption[];
};

const SKILL_CHIP_VISIBLE = 3;

function SkillChips({ skills }: { skills: string[] }) {
  if (skills.length === 0) return null;
  const visible = skills.slice(0, SKILL_CHIP_VISIBLE);
  const overflow = skills.length - visible.length;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {visible.map((s) => (
        <span
          key={s}
          className="inline-flex items-center rounded-full bg-mist/60 text-deep px-2 py-0.5 text-[10.5px] font-medium"
        >
          {s}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="inline-flex items-center rounded-full bg-mist/40 text-deep/70 px-2 py-0.5 text-[10.5px] font-medium"
          title={skills.slice(SKILL_CHIP_VISIBLE).join(", ")}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}

type StatusOption = {
  id: AgentStatus;
  label: string;
  caption: string;
  dot: string;
};

const STATUS_OPTIONS: StatusOption[] = [
  {
    id: "online",
    label: "Online",
    caption: "Assignable — you'll receive new conversations.",
    dot: "bg-emerald-500",
  },
  {
    id: "away",
    label: "Away",
    caption: "Hidden from auto-assignment. Existing chats stay with you.",
    dot: "bg-amber-400",
  },
  {
    id: "offline",
    label: "Offline",
    caption: "Off shift. Not on the queue.",
    dot: "bg-zinc-400",
  },
];

function statusDotColor(s: AgentStatus): string {
  return STATUS_OPTIONS.find((o) => o.id === s)?.dot ?? "bg-zinc-400";
}

function AvatarChip({
  url,
  name,
  size = "sm",
}: {
  url: string | null;
  name: string;
  size?: "sm" | "md";
}) {
  const dims = size === "md" ? "h-12 w-12 text-[15px]" : "h-8 w-8 text-[12px]";
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className={`${dims} rounded-full object-cover border border-mist shrink-0`}
      />
    );
  }
  const initials = name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";
  return (
    <div
      className={`${dims} rounded-full bg-mist/70 border border-mist text-deep font-medium grid place-items-center shrink-0`}
    >
      {initials}
    </div>
  );
}

function BusinessLogoChip({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl: string | null;
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        className="h-7 w-7 rounded-md object-cover flex-shrink-0"
      />
    );
  }
  return (
    <div className="h-7 w-7 rounded-md bg-mist/60 grid place-items-center text-[12px] font-serif-italic text-deep/70 flex-shrink-0">
      {name.charAt(0)?.toUpperCase()}
    </div>
  );
}

export function AgentHubButton(props: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setLocalStatus] = useState<AgentStatus>(props.initialStatus);
  const [timeline, setTimeline] = useState<OwnTimeline | null>(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  // Refetch the timeline whenever the popover opens (and immediately
  // after a status flip) so the strip stays fresh. The loading flag is
  // flipped *inside* the async effect callback (not before it) to keep
  // the effect body free of synchronous setState calls.
  useEffect(() => {
    if (!open || !props.hasAgentRow) return;
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      setLoadingTimeline(true);
      const t = await getOwnTimeline();
      if (cancelled) return;
      setTimeline(t);
      setLoadingTimeline(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, status, props.hasAgentRow]);

  function pickStatus(next: AgentStatus) {
    if (next === status) return;
    setLocalStatus(next);
    startTransition(async () => {
      await setStatus(next);
      router.refresh();
    });
  }

  function pickBusiness(id: string) {
    if (id === props.activeBusinessId) return;
    startTransition(async () => {
      const res = await setActiveBusiness(id);
      if (res.ok) router.refresh();
    });
  }

  function pickInbox(id: string) {
    if (id === props.activeInboxId) return;
    startTransition(async () => {
      const res = await setActiveInbox(id);
      if (res.ok) router.refresh();
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2.5 rounded-full border border-mist bg-white pl-1 pr-3 py-1 text-[13px] text-ink hover:bg-mist/60 transition-colors"
      >
        <span className="relative inline-block">
          <AvatarChip url={props.avatarUrl} name={props.displayName} size="sm" />
          {props.hasAgentRow && (
            <span
              aria-label={`Status: ${status}`}
              className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${statusDotColor(status)}`}
            />
          )}
        </span>
        <span className="flex flex-col items-start leading-tight">
          <span className="text-[13px] font-medium text-ink truncate max-w-[120px]">
            {props.displayName}
          </span>
          <span className="text-[11px] text-deep/60 capitalize">
            {props.hasAgentRow ? status : props.roleLabel.toLowerCase()}
          </span>
        </span>
        <ChevronDown
          className={`h-3 w-3 text-deep/50 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Agent hub"
          className="absolute right-0 top-[calc(100%+8px)] z-40 w-[400px] rounded-2xl border border-mist bg-white shadow-2xl shadow-ink/15 overflow-hidden"
        >
          {/* Identity */}
          <div className="px-5 pt-5 pb-4 flex items-start gap-3">
            <AvatarChip url={props.avatarUrl} name={props.displayName} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[15px] font-semibold text-ink truncate">
                  {props.displayName}
                </p>
                <span className="text-[10px] uppercase tracking-[0.1em] font-medium text-deep/70 bg-mist/60 rounded-full px-2 py-0.5">
                  {props.roleLabel}
                </span>
              </div>
              <p className="text-[12px] text-deep/60 truncate">{props.email}</p>
              <SkillChips skills={props.skills} />
              <Link
                href="/dashboard/settings/account"
                className="mt-1 inline-flex items-center gap-1 text-[12px] text-deep hover:text-ink"
                onClick={() => setOpen(false)}
              >
                <UserCog className="h-3 w-3" />
                Edit profile
              </Link>
            </div>
          </div>

          {/* Status + timeline */}
          {props.hasAgentRow ? (
            <>
              <div className="border-t border-mist/70 px-3 py-3 space-y-1">
                {STATUS_OPTIONS.map((o) => {
                  const active = o.id === status;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => pickStatus(o.id)}
                      className={`w-full flex items-start gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                        active ? "bg-mist/50" : "hover:bg-mist/30"
                      }`}
                    >
                      <span
                        className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${o.dot}`}
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] font-medium text-ink">
                          {o.label}
                        </span>
                        <span className="block text-[11.5px] text-deep/60">
                          {o.caption}
                        </span>
                      </span>
                      {active && (
                        <Check className="h-3.5 w-3.5 text-ink shrink-0 mt-1.5" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-mist/70 px-5 py-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] uppercase tracking-[0.1em] text-deep/60 font-medium">
                    Today
                  </p>
                  <p className="text-[11px] text-deep/60">
                    {loadingTimeline && !timeline
                      ? "loading…"
                      : timeline
                        ? formatTimelineSummary(timeline)
                        : "—"}
                  </p>
                </div>
                <AgentTimelineStrip timeline={timeline} />
              </div>
            </>
          ) : (
            <div className="border-t border-mist/70 px-5 py-4 text-[12px] text-deep/60">
              You manage this workspace as Admin. Status and timeline are
              tracked for invited teammates.
            </div>
          )}

          {/* Workspace picker */}
          <div className="border-t border-mist/70 px-3 py-3 space-y-2">
            <p className="px-2 pt-1 text-[11px] uppercase tracking-[0.1em] text-deep/60 font-medium">
              Workspace
            </p>
            <ul className="space-y-0.5">
              {props.businesses.map((b) => {
                const active = b.id === props.activeBusinessId;
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => pickBusiness(b.id)}
                      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                        active ? "bg-mist/50" : "hover:bg-mist/30"
                      }`}
                    >
                      <BusinessLogoChip name={b.name} logoUrl={b.logoUrl} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] font-medium text-ink truncate">
                          {b.name}
                        </span>
                        <span className="block text-[11px] text-deep/60">
                          {b.planLabel}
                        </span>
                      </span>
                      {active && (
                        <Check className="h-3.5 w-3.5 text-ink shrink-0" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>

            {props.inboxes.length > 0 && (
              <>
                <p className="px-2 pt-3 pb-1 text-[11px] uppercase tracking-[0.1em] text-deep/60 font-medium">
                  Inbox
                </p>
                <ul className="space-y-0.5">
                  {props.inboxes.map((ib) => {
                    const active = ib.id === props.activeInboxId;
                    return (
                      <li key={ib.id}>
                        <button
                          type="button"
                          onClick={() => pickInbox(ib.id)}
                          className={`w-full flex items-center justify-between rounded-xl px-3 py-1.5 text-left transition-colors ${
                            active ? "bg-mist/50" : "hover:bg-mist/30"
                          }`}
                        >
                          <span className="text-[13px] text-ink truncate">
                            {ib.name}
                          </span>
                          {active && (
                            <Check className="h-3.5 w-3.5 text-ink shrink-0" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-mist/70 px-5 py-3 bg-mist/20 flex items-center justify-between">
            <span className="text-[11px] text-deep/60 truncate" title={props.email}>
              Signed in as {props.email}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 text-[12px] text-deep hover:text-ink"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTimelineSummary(t: OwnTimeline): string {
  const secs = t.totalOnlineSeconds;
  const hours = Math.floor(secs / 3600);
  const mins = Math.round((secs % 3600) / 60);
  const label = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  const sessions = t.sessions.length;
  if (sessions === 0) return "Not online yet";
  return `${label} online · ${sessions} session${sessions === 1 ? "" : "s"}`;
}
