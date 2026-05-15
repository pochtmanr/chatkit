import type { ReactNode } from "react";
import Navbar from "@/app/_components/Navbar";
import Footer from "@/app/_components/Footer";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-white text-ink flex flex-col">
      <Navbar />
      <main className="relative flex-1 flex flex-col bg-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-dotted-mist [mask-image:radial-gradient(ellipse_60%_70%_at_center,_black_0%,_transparent_85%)] [-webkit-mask-image:radial-gradient(ellipse_60%_70%_at_center,_black_0%,_transparent_85%)]"
        />
        <div className="relative flex-1 flex flex-col">{children}</div>
      </main>
      <Footer />
    </div>
  );
}
