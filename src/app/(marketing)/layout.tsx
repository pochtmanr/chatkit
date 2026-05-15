import type { ReactNode } from "react";
import Navbar from "@/app/_components/Navbar";
import Footer from "@/app/_components/Footer";

/**
 * Marketing-pages layout.
 *
 * Owns the Navbar (fixed at the top, out of document flow) and the
 * Footer so individual pages don't mount them themselves. Pages are
 * responsible for the first section's own background — Hero's
 * mist+dotted band extends to the viewport top so the navbar pill
 * floats on top of it instead of sitting on a stark white strip.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-white text-ink flex flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
