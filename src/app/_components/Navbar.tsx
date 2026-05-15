import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-4 sm:pt-6">
        <nav className="flex items-center justify-between rounded-full bg-white/90 backdrop-blur-md border border-zinc-200/80 shadow-lg shadow-ink/5 p-2">
          <Link
            href="/"
            aria-label="TinyChat"
            className="grid place-items-center h-10 w-10 rounded-full bg-white border border-zinc-200/80 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
          >
            <Image
              src="/tclogo.png"
              alt="TinyChat"
              width={32}
              height={32}
              priority
              className="h-8 w-8 rounded-full"
            />
          </Link>

          <div className="hidden md:flex items-center gap-1 text-sm font-medium text-deep">
            <Link
              href="/#features"
              className="px-4 py-2 rounded-full hover:bg-mist transition-colors"
            >
              Features
            </Link>
            <Link
              href="/sdk"
              className="px-4 py-2 rounded-full hover:bg-mist transition-colors"
            >
              SDK
            </Link>
            <Link
              href="/api-reference"
              className="px-4 py-2 rounded-full hover:bg-mist transition-colors"
            >
              API
            </Link>
          </div>

          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-ink text-white pl-4 pr-2 py-1 text-sm hover:bg-deep transition-colors"
          >
            Sign in
            <span className="grid place-items-center h-7 w-7 rounded-full bg-white text-ink">
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
