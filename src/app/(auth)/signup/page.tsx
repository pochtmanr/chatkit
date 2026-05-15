import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { signUpAction, signInWithGoogleAction } from "../actions";

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
    <section className="min-h-dvh flex items-center mx-auto w-full max-w-7xl px-4 sm:px-6 pt-28 sm:pt-32 pb-12">
      <div className="w-full">
        <div className="bg-deep rounded-[48px] shadow-xl overflow-hidden">
          <div className="bg-white rounded-[40px] m-2 shadow-sm">
            <div className="p-8 md:p-10 lg:p-12 grid grid-cols-1 lg:grid-cols-5 gap-12">
              {/* Heading column */}
              <div className="lg:col-span-2 space-y-6">
                <p className="text-[14px] font-medium text-deep/60">Sign up</p>
                <h1 className="text-4xl sm:text-5xl tracking-tight text-ink leading-[1] font-normal">
                  Start in{" "}
                  <span className="font-serif-italic font-normal text-deep">
                    seconds<span className="text-deep/40">.</span>
                  </span>
                </h1>
                <p className="text-deep/70 leading-relaxed text-[16px] font-normal max-w-[320px]">
                  One free workspace. One API key. Drop the snippet in your
                  React Native or web app and you&apos;re live.
                </p>

                <ul className="space-y-3 pt-2">
                  {[
                    "Free for your first 100 conversations",
                    "No credit card required",
                    "Cancel anytime",
                  ].map((line) => (
                    <li
                      key={line}
                      className="flex items-start gap-3 text-[14px] text-deep/70"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-deep/40 shrink-0" />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Form column */}
              <div className="lg:col-span-3">
                <div className="lg:max-w-[440px] lg:ml-auto flex flex-col gap-5">
                  <form action={signInWithGoogleAction}>
                    <button
                      type="submit"
                      className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-mist bg-white px-4 py-3 text-[15px] font-medium text-ink shadow-[0_1px_2px_rgba(11,11,11,0.05)] hover:bg-mist/40 hover:border-deep/20 transition-all active:scale-[0.99]"
                    >
                      <GoogleGlyph />
                      Continue with Google
                    </button>
                  </form>

                  <div className="flex items-center gap-3 text-[13px] text-deep/50">
                    <span className="h-px flex-1 bg-mist" />
                    or sign up with email
                    <span className="h-px flex-1 bg-mist" />
                  </div>

                  <form action={action} className="flex flex-col gap-4">
                    <Field
                      label="Workspace name"
                      name="orgName"
                      type="text"
                      placeholder="Acme Deliveries"
                    />

                    <Field
                      label="Email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@company.com"
                    />

                    <Field
                      label="Password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      minLength={8}
                    />

                    {error && (
                      <p className="text-[14px] font-medium text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                        {error}
                      </p>
                    )}

                    <button
                      type="submit"
                      className="mt-1 w-full inline-flex items-center justify-between gap-2 rounded-full bg-ink text-white pl-5 pr-2 py-2 text-[15px] font-medium hover:bg-deep transition-colors"
                    >
                      <span className="flex-1 text-center pl-8">
                        Create account
                      </span>
                      <span className="grid place-items-center h-8 w-8 rounded-full bg-white text-ink">
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom strip — sign in CTA, on deep frame */}
          <div className="px-6 sm:px-12 md:px-16 lg:px-20 py-5 flex flex-col md:flex-row justify-between items-center gap-6 text-[15px]">
            <p className="text-white/70 font-medium">Already have an account?</p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-white font-medium hover:text-mist transition-colors"
            >
              Sign in
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  name,
  type,
  autoComplete,
  placeholder,
  minLength,
}: {
  label: string;
  name: string;
  type: string;
  autoComplete?: string;
  placeholder?: string;
  minLength?: number;
}) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium text-deep/70">{label}</span>
      <input
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        placeholder={placeholder}
        minLength={minLength}
        className="mt-1.5 w-full rounded-xl border border-mist bg-white px-4 py-3 text-[15px] text-ink placeholder:text-deep/30 shadow-[0_1px_2px_rgba(11,11,11,0.03)] focus:outline-none focus:border-deep/40 focus:ring-2 focus:ring-deep/10 transition-all"
      />
    </label>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
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
