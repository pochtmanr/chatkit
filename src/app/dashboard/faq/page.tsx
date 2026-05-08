import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Trash2, Plus } from "lucide-react";
import { getServerClient } from "@/lib/supabase/server";

const AUDIENCES = ["customer", "driver", "admin"] as const;
const LANGUAGES = ["en", "he"] as const;

type Audience = (typeof AUDIENCES)[number];
type Language = (typeof LANGUAGES)[number];

export default async function FaqPage({
  searchParams,
}: {
  searchParams: Promise<{ audience?: Audience; language?: Language }>;
}) {
  const sp = await searchParams;
  const audience: Audience = AUDIENCES.includes(sp.audience as Audience)
    ? (sp.audience as Audience)
    : "customer";
  const language: Language = LANGUAGES.includes(sp.language as Language)
    ? (sp.language as Language)
    : "en";

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id")
    .eq("owner_user_id", user!.id)
    .limit(1);
  const tenantId = tenants?.[0]?.id;

  const { data: items } = tenantId
    ? await supabase
        .from("faq_items")
        .select("id, question, answer, action_href, position, is_published")
        .eq("tenant_id", tenantId)
        .eq("audience", audience)
        .eq("language", language)
        .order("position")
    : { data: [] };

  async function createItem(formData: FormData) {
    "use server";
    const tid = String(formData.get("tenantId") ?? "");
    const aud = String(formData.get("audience") ?? "customer") as Audience;
    const lang = String(formData.get("language") ?? "en") as Language;
    const question = String(formData.get("question") ?? "").trim();
    const answer = String(formData.get("answer") ?? "").trim();
    const actionHref = String(formData.get("action_href") ?? "").trim();
    if (!question || !answer || !tid) return;
    const sb = await getServerClient();
    const { count } = await sb
      .from("faq_items")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .eq("audience", aud)
      .eq("language", lang);
    await sb.from("faq_items").insert({
      tenant_id: tid,
      audience: aud,
      language: lang,
      question,
      answer,
      action_href: actionHref || null,
      position: count ?? 0,
      is_published: true,
    });
    revalidatePath(`/dashboard/faq?audience=${aud}&language=${lang}`);
    redirect(`/dashboard/faq?audience=${aud}&language=${lang}`);
  }

  async function deleteItem(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    const aud = String(formData.get("audience") ?? "customer") as Audience;
    const lang = String(formData.get("language") ?? "en") as Language;
    const sb = await getServerClient();
    await sb.from("faq_items").delete().eq("id", id);
    revalidatePath(`/dashboard/faq?audience=${aud}&language=${lang}`);
    redirect(`/dashboard/faq?audience=${aud}&language=${lang}`);
  }

  async function togglePublish(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    const next = formData.get("isPublished") === "true";
    const aud = String(formData.get("audience") ?? "customer") as Audience;
    const lang = String(formData.get("language") ?? "en") as Language;
    const sb = await getServerClient();
    await sb.from("faq_items").update({ is_published: !next }).eq("id", id);
    revalidatePath(`/dashboard/faq?audience=${aud}&language=${lang}`);
    redirect(`/dashboard/faq?audience=${aud}&language=${lang}`);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">FAQ</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Help articles shown in the chat widget. Different lists per audience and language.
          </p>
        </div>
      </header>

      {/* Audience tabs */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1">
          {AUDIENCES.map((a) => (
            <a
              key={a}
              href={`/dashboard/faq?audience=${a}&language=${language}`}
              className={`px-3 py-1.5 text-sm rounded-md ${
                a === audience
                  ? "bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {a[0].toUpperCase() + a.slice(1)}
            </a>
          ))}
        </div>
        <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1">
          {LANGUAGES.map((l) => (
            <a
              key={l}
              href={`/dashboard/faq?audience=${audience}&language=${l}`}
              className={`px-3 py-1.5 text-sm rounded-md ${
                l === language
                  ? "bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {l.toUpperCase()}
            </a>
          ))}
        </div>
      </div>

      {/* Existing items */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-200 dark:divide-zinc-800">
        {(items ?? []).length === 0 ? (
          <p className="p-6 text-sm text-zinc-500">
            No FAQ items yet for {audience} ({language.toUpperCase()}). Add your first one below.
          </p>
        ) : (
          items!.map((it) => (
            <div key={it.id} className="p-5 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-medium">{it.question}</div>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                  {it.answer}
                </p>
                {it.action_href && (
                  <code className="mt-2 inline-block text-xs text-zinc-500 font-mono bg-zinc-100 dark:bg-zinc-800 rounded px-1.5 py-0.5">
                    → {it.action_href}
                  </code>
                )}
              </div>
              <form action={togglePublish}>
                <input type="hidden" name="id" value={it.id} />
                <input type="hidden" name="isPublished" value={String(it.is_published)} />
                <input type="hidden" name="audience" value={audience} />
                <input type="hidden" name="language" value={language} />
                <button
                  type="submit"
                  className={`rounded-lg border px-2.5 py-1 text-xs ${
                    it.is_published
                      ? "border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40"
                      : "border-zinc-300 dark:border-zinc-700 text-zinc-500"
                  }`}
                >
                  {it.is_published ? "Published" : "Draft"}
                </button>
              </form>
              <form action={deleteItem}>
                <input type="hidden" name="id" value={it.id} />
                <input type="hidden" name="audience" value={audience} />
                <input type="hidden" name="language" value={language} />
                <button
                  type="submit"
                  aria-label="Delete"
                  className="rounded-lg border border-zinc-300 dark:border-zinc-700 p-1.5 text-zinc-500 hover:text-red-600 hover:border-red-300"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </form>
            </div>
          ))
        )}
      </div>

      {/* New item form */}
      <form
        action={createItem}
        className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-3"
      >
        <h2 className="font-semibold flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add a new FAQ item
        </h2>
        <input type="hidden" name="tenantId" value={tenantId ?? ""} />
        <input type="hidden" name="audience" value={audience} />
        <input type="hidden" name="language" value={language} />
        <label className="block text-sm">
          Question
          <input
            name="question"
            required
            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
            placeholder="How do I track my order?"
          />
        </label>
        <label className="block text-sm">
          Answer
          <textarea
            name="answer"
            required
            rows={4}
            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
            placeholder="Open Orders → tap the order → live tracking…"
          />
        </label>
        <label className="block text-sm">
          Optional deep-link (action_href)
          <input
            name="action_href"
            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm font-mono"
            placeholder="navigate://documents"
          />
          <span className="mt-1 block text-xs text-zinc-500">
            When set, tapping the FAQ row navigates instead of opening the answer.
          </span>
        </label>
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white px-4 py-2 text-sm font-medium"
        >
          Add item
        </button>
      </form>
    </div>
  );
}
