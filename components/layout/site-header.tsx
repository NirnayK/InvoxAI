import Link from "next/link";

import { ModeToggle } from "@/components/theme/theme-switcher";

export function SiteHeader() {
  return (
    <nav className="border-b border-border/60 bg-background shadow-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 text-sm text-foreground">
        <Link className="text-base font-semibold uppercase tracking-[0.3em]" href="/">
          Invox AI
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            Dashboard
          </Link>
          <Link
            href="/account"
            className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            Account
          </Link>
          <ModeToggle />
        </div>
      </div>
    </nav>
  );
}
