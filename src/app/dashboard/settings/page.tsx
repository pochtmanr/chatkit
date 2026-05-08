import { revalidatePath } from "next/cache";
import { getServerClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name, email_from, plan")
    .eq("owner_user_id", user!.id)
    .limit(1);
  const tenant = tenants?.[0];

  async function save(formData: FormData) {
    "use server";
    if (!tenant) return;
    const name = String(formData.get("name") ?? "").trim();
    const emailFrom = String(formData.get("email_from") ?? "").trim() || null;
    const sb = await getServerClient();
    await sb
      .from("tenants")
      .update({ name: name || tenant.name, email_from: emailFrom })
      .eq("id", tenant.id);
    revalidatePath("/dashboard/settings");
  }

  if (!tenant) {
    return <p className="text-sm text-zinc-500">No workspace found.</p>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">Workspace name and email sender.</p>
      </header>
      <form
        action={save}
        className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4"
      >
        <label className="block text-sm">
          Workspace name
          <input
            name="name"
            defaultValue={tenant.name}
            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          Email "from" address
          <input
            name="email_from"
            type="email"
            defaultValue={tenant.email_from ?? ""}
            placeholder="support@yourapp.com"
            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-xs text-zinc-500">
            We'll need to verify the domain before sending — that comes in the
            next iteration of the email pipeline.
          </span>
        </label>
        <div className="text-sm text-zinc-500">
          Current plan: <span className="capitalize font-medium">{tenant.plan}</span>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white px-4 py-2 text-sm font-medium"
        >
          Save
        </button>
      </form>
    </div>
  );
}
