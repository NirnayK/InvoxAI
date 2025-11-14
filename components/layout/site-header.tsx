import Link from "next/link";

import { ModeToggle } from "@/components/theme/theme-switcher";

export function SiteHeader() {
  return (
    <nav className="border-b border-slate-200/70 bg-white/90">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 text-sm">
        <Link className="font-semibold text-base tracking-[0.3em] uppercase" href="/">
          Invox AI
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            Dashboard
          </Link>
          <Link
            href="/new-task"
            className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            New Task
          </Link>
          <ModeToggle />
        </div>
      </div>
    </nav>
  );
}
