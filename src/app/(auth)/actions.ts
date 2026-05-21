"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getServerClient } from "@/lib/supabase/server";

/** Resolve the public site origin (used to build OAuth redirect URLs).
 *  Prefers NEXT_PUBLIC_SITE_URL; falls back to the request's Host header
 *  so previews (Vercel branch URLs) don't ping back to prod. */
async function siteOrigin() {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

export async function signUpAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  // `orgName` is no longer collected here — the onboarding wizard
  // captures the business name. Old signup forms may still post it; we
  // simply ignore the field.

  if (!email || !password) {
    return { ok: false as const, error: "Email and password are required." };
  }

  const supabase = await getServerClient();
  const origin = await siteOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // Must point at /auth/callback — that's the only route that knows how
    // to exchange the verification code for a session. Sending users to /
    // drops the token on the floor and the link "expires" silently.
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) return { ok: false as const, error: error.message };
  if (!data.user) return { ok: false as const, error: "Sign-up failed." };

  redirect("/dashboard");
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  const supabase = await getServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/", "layout");
  redirect(next);
}

export async function logoutAction() {
  const supabase = await getServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

/** Kick off the Google OAuth flow. Server action returns a Supabase-issued
 *  authorization URL; we redirect the browser there. After Google succeeds,
 *  Supabase bounces the user to /auth/callback with a `?code=` we exchange
 *  for a session. */
export async function signInWithGoogleAction(formData: FormData) {
  const next = String(formData.get("next") ?? "/dashboard");
  const supabase = await getServerClient();
  const origin = await siteOrigin();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });
  if (error || !data?.url) {
    redirect(`/login?error=${encodeURIComponent(error?.message ?? "Google sign-in failed.")}`);
  }
  redirect(data.url);
}
