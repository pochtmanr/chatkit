import Link from "next/link";
import { loginAction, signInWithGoogleAction } from "../actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next = "/dashboard", error } = await searchParams;

  async function action(formData: FormData) {
    "use server";
    const res = await loginAction(formData);
    if (res?.ok === false) {
      const { redirect } = await import("next/navigation");
      redirect(`/login?error=${encodeURIComponent(res.error)}&next=${encodeURIComponent(next)}`);
    }
  }

  return (
    <main className="min-h-dvh grid place-items-center px-6 bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm flex flex-col gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-zinc-500">Welcome back to HolyLabs Chat.</p>
        </div>
        <form action={signInWithGoogleAction}>
          <input type="hidden" name="next" value={next} />
          <button
            type="submit"
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-center gap-2"
          >
            <GoogleGlyph />
            Continue with Google
          </button>
        </form>
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          or
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
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
            autoComplete="current-password"
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
          Sign in
        </button>
        </form>
        <p className="text-sm text-zinc-500 text-center">
          New here?{" "}
          <Link href="/signup" className="font-medium underline underline-offset-2">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 3l5.7-5.7C33.9 6.5 29.2 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3 0 5.7 1.1 7.8 3l5.7-5.7C33.9 6.5 29.2 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 43.5c5 0 9.6-1.9 13.1-5.1l-6.1-5c-2 1.4-4.4 2.1-7 2.1-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.4 39 16.1 43.5 24 43.5z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4 5.7l6.1 5C40.7 36.2 43.5 30.5 43.5 24c0-1.2-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
