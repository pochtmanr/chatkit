import { revalidatePath } from "next/cache";
import { getServerClient, getServiceClient } from "@/lib/supabase/server";
import { HubSpotOwnerPicker } from "./HubSpotOwnerPicker";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ hubspot?: string; hubspot_error?: string }>;
}) {
  const { hubspot: hubspotStatus, hubspot_error: hubspotError } = await searchParams;
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: tenants } = await supabase
    .from("tenants")
    .select(
      "id, name, email_from, plan, integration_type, hubspot_portal_id, hubspot_owner_id",
    )
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

  async function disconnectHubSpot() {
    "use server";
    if (!tenant) return;
    // Service client because integration_type/tokens aren't writable
    // through anon's RLS — they're sensitive fields.
    const service = getServiceClient();
    await service
      .from("tenants")
      .update({
        integration_type: "native",
        hubspot_access_token: null,
        hubspot_refresh_token: null,
        hubspot_token_expires_at: null,
        hubspot_portal_id: null,
        hubspot_owner_id: null,
      })
      .eq("id", tenant.id);
    revalidatePath("/dashboard/settings");
  }

  async function saveHubSpotOwner(formData: FormData) {
    "use server";
    if (!tenant) return;
    const ownerId = String(formData.get("hubspot_owner_id") ?? "").trim() || null;
    const service = getServiceClient();
    await service
      .from("tenants")
      .update({ hubspot_owner_id: ownerId })
      .eq("id", tenant.id);
    revalidatePath("/dashboard/settings");
  }

  if (!tenant) {
    return <p className="text-sm text-zinc-500">No workspace found.</p>;
  }

  const hubspotConnected = tenant.integration_type === "hubspot" && !!tenant.hubspot_portal_id;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">Workspace, email sender, integrations.</p>
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

      <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">HubSpot</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Mirror chat conversations into HubSpot tickets. Each chat
              session becomes one ticket; follow-up messages land as notes
              on that ticket.
            </p>
          </div>
          {hubspotConnected ? (
            <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-3 py-1 text-xs font-medium">
              Connected
            </span>
          ) : (
            <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-3 py-1 text-xs font-medium">
              Not connected
            </span>
          )}
        </div>

        {hubspotStatus === "connected" && (
          <p className="text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-3 py-2">
            HubSpot connected. New chat conversations will create tickets
            in your Service pipeline.
          </p>
        )}
        {hubspotError && (
          <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
            HubSpot error: {hubspotError}
          </p>
        )}

        {hubspotConnected ? (
          <>
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              Portal:{" "}
              <span className="font-mono">{tenant.hubspot_portal_id}</span>
            </div>
            <HubSpotOwnerPicker
              initialOwnerId={tenant.hubspot_owner_id ?? null}
              saveAction={saveHubSpotOwner}
            />
            <form action={disconnectHubSpot}>
              <button
                type="submit"
                className="text-sm text-red-600 hover:underline"
              >
                Disconnect HubSpot
              </button>
            </form>
          </>
        ) : (
          <a
            href="/api/hubspot/oauth/start"
            className="inline-block rounded-lg bg-[#ff7a59] hover:bg-[#ff6347] text-white px-4 py-2 text-sm font-medium"
          >
            Connect HubSpot
          </a>
        )}
      </section>
    </div>
  );
}
