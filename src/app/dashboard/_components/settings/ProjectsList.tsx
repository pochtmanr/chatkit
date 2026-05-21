"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, X } from "lucide-react";
import { renameProject } from "@/app/dashboard/_actions/projects";
import type { ProjectGroup } from "@/lib/active-context";

export function ProjectsList({ groups }: { groups: ProjectGroup[] }) {
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function commitRename(projectId: string, name: string) {
    setError(null);
    startTransition(async () => {
      const res = await renameProject({ projectId, name });
      if (!res.ok) return setError(res.error);
      setEditingId(null);
    });
  }

  return (
    <section className="space-y-3">
      <h2 className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
        Projects
      </h2>
      <div className="rounded-2xl bg-white border border-mist/80 divide-y divide-mist overflow-hidden">
        {groups.map((g) => (
          <ProjectRow
            key={g.project.id}
            project={g.project}
            inboxCount={g.inboxes.length}
            editing={editingId === g.project.id}
            onStartEdit={() => setEditingId(g.project.id)}
            onCancelEdit={() => setEditingId(null)}
            onCommit={(name) => commitRename(g.project.id, name)}
            pending={pending}
          />
        ))}
        {groups.length === 0 && (
          <div className="px-5 py-6 text-[13px] text-deep/60">
            No active projects.
          </div>
        )}
      </div>
      {error && <p className="text-[13px] text-red-700">{error}</p>}
    </section>
  );
}

function ProjectRow({
  project,
  inboxCount,
  editing,
  onStartEdit,
  onCancelEdit,
  onCommit,
  pending,
}: {
  project: { id: string; name: string; slug: string };
  inboxCount: number;
  editing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onCommit: (name: string) => void;
  pending: boolean;
}) {
  const [draft, setDraft] = useState(project.name);
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      {editing ? (
        <>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCommit(draft);
              if (e.key === "Escape") onCancelEdit();
            }}
            autoFocus
            className="flex-1 rounded-lg border border-deep/40 bg-white px-3 py-1.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-deep/10"
          />
          <button
            type="button"
            onClick={() => onCommit(draft)}
            disabled={pending}
            className="p-1.5 rounded-full bg-ink text-white hover:bg-deep transition-colors disabled:opacity-60"
            aria-label="Save rename"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onCancelEdit}
            className="p-1.5 rounded-full bg-white border border-mist hover:bg-mist/40 transition-colors"
            aria-label="Cancel rename"
          >
            <X className="h-3.5 w-3.5 text-deep/70" />
          </button>
        </>
      ) : (
        <>
          <div className="flex-1">
            <div className="text-[14px] font-medium text-ink">
              {project.name}
            </div>
            <div className="text-[12px] text-deep/60">
              {inboxCount} inbox{inboxCount === 1 ? "" : "es"}
            </div>
          </div>
          <button
            type="button"
            onClick={onStartEdit}
            aria-label="Rename project"
            className="p-1.5 rounded-full bg-white border border-mist hover:bg-mist/40 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5 text-deep/70" />
          </button>
        </>
      )}
    </div>
  );
}
