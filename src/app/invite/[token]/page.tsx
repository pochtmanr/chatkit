import Link from "next/link";
import { getServiceClient } from "@/lib/supabase/server";
import { getInvitationByToken } from "@/lib/invitations";
import { AcceptForm } from "./AcceptForm";

export const dynamic = "force-dynamic";

async function emailHasAuthUser(email: string): Promise<boolean> {
  const admin = getServiceClient();
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  return Boolean(
    data?.users?.some((u) => (u.email ?? "").toLowerCase() === email.toLowerCase()),
  );
}

async function inviterEmail(userId: string): Promise<string | null> {
  const admin = getServiceClient();
  const { data } = await admin.auth.admin.getUserById(userId);
  return data?.user?.email ?? null;
}

function InvalidState({
  reason,
  inviterMail,
}: {
  reason: string;
  inviterMail: string | null;
}) {
  return (
    <div className="min-h-screen grid place-items-center px-6 py-12">
      <div className="max-w-md w-full rounded-2xl border border-mist bg-white p-8 space-y-4">
        <p className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
          Chatkit invite
        </p>
        <h1 className="text-[22px] font-semibold text-ink">
          Invite no longer valid
        </h1>
        <p className="text-[14px] text-deep/80">{reason}</p>
        {inviterMail && (
          <p className="text-[13px] text-deep/60">
            Ask{" "}
            <a
              className="text-ink underline"
              href={`mailto:${inviterMail}?subject=Chatkit%20invite`}
            >
              {inviterMail}
            </a>{" "}
            to send a fresh one.
          </p>
        )}
        <p className="text-[13px]">
          <Link href="/" className="text-deep underline">
            Back to chatkit.dev
          </Link>
        </p>
      </div>
    </div>
  );
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invitation = await getInvitationByToken(token);
  if (!invitation) {
    return (
      <InvalidState
        reason="We couldn't find this invitation. The link may be broken or the invite was rescinded."
        inviterMail={null}
      />
    );
  }

  const inviterMail = await inviterEmail(invitation.invited_by);

  if (invitation.revoked_at) {
    return (
      <InvalidState
        reason="This invitation was revoked by the team."
        inviterMail={inviterMail}
      />
    );
  }
  if (invitation.accepted_at) {
    return (
      <InvalidState
        reason="This invitation has already been accepted. Sign in with the email it was sent to."
        inviterMail={inviterMail}
      />
    );
  }
  // eslint-disable-next-line react-hooks/purity -- server component, single render per request
  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    return (
      <InvalidState
        reason="This invitation has expired (invites are valid for 7 days)."
        inviterMail={inviterMail}
      />
    );
  }

  const admin = getServiceClient();
  const { data: biz } = await admin
    .from("businesses")
    .select("name")
    .eq("id", invitation.business_id)
    .maybeSingle();

  const existingUser = await emailHasAuthUser(invitation.email);

  return (
    <div className="min-h-screen grid place-items-center px-6 py-12 bg-mist/30">
      <div className="max-w-md w-full rounded-2xl border border-mist bg-white p-8 space-y-6">
        <div className="space-y-1">
          <p className="text-[12px] uppercase tracking-[0.12em] text-deep/50">
            Join the team
          </p>
          <h1 className="text-[22px] font-semibold text-ink">
            You&apos;re invited to {biz?.name ?? "Chatkit"}
          </h1>
          <p className="text-[14px] text-deep/70">
            as a {invitation.role === "manager" ? "team manager" : "support agent"}.
          </p>
        </div>

        <AcceptForm
          token={token}
          email={invitation.email}
          suggestedDisplayName={invitation.display_name}
          isExistingUser={existingUser}
        />
      </div>
    </div>
  );
}
