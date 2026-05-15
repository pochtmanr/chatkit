import type { Metadata } from "next";

import { ContactCard } from "./_components/ContactCard";
import { HelpGrid } from "./_components/HelpGrid";
import { StatusStrip } from "./_components/StatusStrip";
import { SupportHero } from "./_components/SupportHero";
import { VisitorSupportWidget } from "./_components/VisitorSupportWidget";

export const metadata: Metadata = {
  title: "Support — TinyChat",
  description:
    "Get help from the TinyChat team. Tap the chat bubble to talk to us — yes, it's our own product.",
};

export default function SupportPage() {
  const supportKey = process.env.NEXT_PUBLIC_TINYCHAT_SUPPORT_KEY;

  return (
    <>
      <SupportHero />
      <HelpGrid />
      <ContactCard hasWidget={Boolean(supportKey)} />
      <StatusStrip />
      {supportKey && <VisitorSupportWidget apiKey={supportKey} />}
    </>
  );
}
