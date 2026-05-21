"use client";

import { useReducer, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveProfileRole,
  createBusiness,
  createProject,
  createInbox,
  completeOnboarding,
} from "@/app/dashboard/_actions/onboarding";
import type {
  ProfileRole,
  CompanySize,
  Industry,
  InboxPurpose,
  Audience,
} from "@/lib/onboarding/enums";
import { StepRole } from "./StepRole";
import { StepBusiness } from "./StepBusiness";
import { StepProject } from "./StepProject";
import { StepInbox } from "./StepInbox";

type StepIndex = 0 | 1 | 2 | 3;

type State = {
  step: StepIndex;
  role: ProfileRole | null;
  businessId: string | null;
  projectId: string | null;
  apiKey: string | null;
  error: string | null;
};

type Action =
  | { type: "advance" }
  | { type: "back" }
  | { type: "set_role"; role: ProfileRole }
  | { type: "set_business"; id: string }
  | { type: "set_project"; id: string }
  | { type: "set_inbox"; apiKey: string }
  | { type: "error"; message: string }
  | { type: "clear_error" };

const initial: State = {
  step: 0,
  role: null,
  businessId: null,
  projectId: null,
  apiKey: null,
  error: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "advance":
      return {
        ...state,
        step: Math.min(3, state.step + 1) as StepIndex,
        error: null,
      };
    case "back":
      return {
        ...state,
        step: Math.max(0, state.step - 1) as StepIndex,
        error: null,
      };
    case "set_role":
      return { ...state, role: action.role };
    case "set_business":
      return { ...state, businessId: action.id };
    case "set_project":
      return { ...state, projectId: action.id };
    case "set_inbox":
      return { ...state, apiKey: action.apiKey };
    case "error":
      return { ...state, error: action.message };
    case "clear_error":
      return { ...state, error: null };
  }
}

export function OnboardingModal({ userEmail }: { userEmail: string }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submitRole(role: ProfileRole) {
    startTransition(async () => {
      const res = await saveProfileRole(role);
      if (!res.ok) return dispatch({ type: "error", message: res.error });
      dispatch({ type: "set_role", role });
      dispatch({ type: "advance" });
    });
  }

  function submitBusiness(input: {
    name: string;
    companySize: CompanySize;
    industry: Industry;
  }) {
    startTransition(async () => {
      const res = await createBusiness(input);
      if (!res.ok) return dispatch({ type: "error", message: res.error });
      dispatch({ type: "set_business", id: res.businessId });
      dispatch({ type: "advance" });
    });
  }

  function submitProject(input: { name: string; description?: string }) {
    if (!state.businessId) {
      return dispatch({ type: "error", message: "lost business id" });
    }
    const businessId = state.businessId;
    startTransition(async () => {
      const res = await createProject({ businessId, ...input });
      if (!res.ok) return dispatch({ type: "error", message: res.error });
      dispatch({ type: "set_project", id: res.projectId });
      dispatch({ type: "advance" });
    });
  }

  function submitInbox(input: {
    name: string;
    purpose: InboxPurpose;
    audience: Audience;
  }) {
    if (!state.projectId || !state.businessId) {
      return dispatch({ type: "error", message: "lost project id" });
    }
    const projectId = state.projectId;
    const businessId = state.businessId;
    startTransition(async () => {
      const inbox = await createInbox({ projectId, ...input });
      if (!inbox.ok) return dispatch({ type: "error", message: inbox.error });
      const finish = await completeOnboarding(businessId);
      if (!finish.ok) return dispatch({ type: "error", message: finish.error });
      dispatch({ type: "set_inbox", apiKey: inbox.apiKey });
      router.refresh();
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-heading"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-[680px]">
        <div className="bg-deep rounded-[48px] shadow-xl overflow-hidden">
          <div className="bg-white rounded-[40px] m-2 shadow-sm">
            <div className="p-8 md:p-10 lg:p-12">
              <StepHeader step={state.step} />

              <div
                key={state.step}
                className="mt-8 animate-[fade-up_220ms_ease-out]"
              >
                {state.step === 0 && (
                  <StepRole
                    initial={state.role}
                    pending={pending}
                    onContinue={submitRole}
                  />
                )}
                {state.step === 1 && (
                  <StepBusiness
                    pending={pending}
                    onBack={() => dispatch({ type: "back" })}
                    onContinue={submitBusiness}
                  />
                )}
                {state.step === 2 && (
                  <StepProject
                    pending={pending}
                    onBack={() => dispatch({ type: "back" })}
                    onContinue={submitProject}
                  />
                )}
                {state.step === 3 && (
                  <StepInbox
                    pending={pending}
                    onBack={() => dispatch({ type: "back" })}
                    onContinue={submitInbox}
                  />
                )}
              </div>

              {state.error && (
                <p className="mt-6 text-[14px] font-medium text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  {state.error}
                </p>
              )}

              <p className="mt-8 text-[12px] text-deep/40">
                Signed in as {userEmail}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepHeader({ step }: { step: StepIndex }) {
  const titles: Array<{
    eyebrow: string;
    head: string;
    accent: string;
    sub: string;
  }> = [
    {
      eyebrow: "Step 1 of 4",
      head: "Tell us who you",
      accent: "are",
      sub: "We tailor the next screens to your role.",
    },
    {
      eyebrow: "Step 2 of 4",
      head: "Set up your",
      accent: "business",
      sub: "This is the workspace your inboxes live in. You can add a second business later.",
    },
    {
      eyebrow: "Step 3 of 4",
      head: "Create your first",
      accent: "project",
      sub: "Projects group inboxes. e.g. a delivery company might have a Logistics project for couriers/warehouse and a Customer project for end-users.",
    },
    {
      eyebrow: "Step 4 of 4",
      head: "Add your first",
      accent: "inbox",
      sub: "Each inbox is one integration — its own API key and webhook URL.",
    },
  ];
  const t = titles[step];
  return (
    <header className="space-y-4">
      <p className="text-[14px] font-medium text-deep/60">{t.eyebrow}</p>
      <h1
        id="onboarding-heading"
        className="text-4xl sm:text-5xl tracking-tight text-ink leading-[1] font-normal"
      >
        {t.head}{" "}
        <span className="font-serif-italic font-normal text-deep">
          {t.accent}
          <span className="text-deep/40">.</span>
        </span>
      </h1>
      <p className="text-deep/70 leading-relaxed text-[16px] font-normal max-w-[520px]">
        {t.sub}
      </p>
    </header>
  );
}
