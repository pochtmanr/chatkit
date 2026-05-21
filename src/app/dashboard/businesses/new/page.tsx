import { redirect } from "next/navigation";
import { requireActiveContext } from "@/lib/active-context";
import { PageHeader } from "@/app/dashboard/_components/shared/PageHeader";
import { CreateBusinessForm } from "./CreateBusinessForm";

export default async function NewBusinessPage() {
  const ctx = await requireActiveContext();
  if (ctx.businesses.length >= 2) {
    redirect("/dashboard/settings?capReached=1");
  }
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Onboarding"
        head="Create a new"
        accent="business"
        description="Spin up another business under your account. You can have up to two."
      />
      <CreateBusinessForm />
    </div>
  );
}
