import Link from "next/link";
import { signUpAction } from "../actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  async function action(formData: FormData) {
    "use server";
    const res = await signUpAction(formData);
    if (res?.ok === false) {
      const { redirect } = await import("next/navigation");
      redirect(`/signup?error=${encodeURIComponent(res.error)}`);
    }
  }

  return (
    <main className="min-h-dvh grid place-items-center px-6 bg-zinc-50 dark:bg-zinc-950">
      <form
        action={action}
        className="w-full max-w-sm rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm flex flex-col gap-4"
      >
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Create account</h1>
          <p className="text-sm text-zinc-500">
            One free workspace, one API key. Set up in 30 seconds.
          </p>
        </div>
        <label className="text-sm font-medium">
          Workspace name
          <input
            name="orgName"
            type="text"
            required
            placeholder="Acme Deliveries"
            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <label className="text-sm font-medium">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <label className="text-sm font-medium">
          Password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="w-full rounded-lg bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white px-3 py-2 text-sm font-medium hover:opacity-90"
        >
          Create account
        </button>
        <p className="text-sm text-zinc-500 text-center">
          Already have one?{" "}
          <Link href="/login" className="font-medium underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
