import Link from "next/link";

import { AuthButton } from "@/components/auth-button";
import { ModeToggle } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { FileUploadPanel } from "@/components/file-upload-panel";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col gap-20">
        <nav className="w-full border-b border-foreground/10">
          <div className="w-full max-w-6xl mx-auto flex h-16 items-center justify-between px-6 text-sm">
            <Link className="font-semibold text-base tracking-[0.3em] uppercase" href="/">
              Invox AI
            </Link>
            <div className="flex items-center gap-4">
              <ModeToggle />
              <AuthButton />
            </div>
          </div>
        </nav>

        <div className="flex w-full flex-1 items-center justify-center">
          <div className="w-full max-w-4xl space-y-12 px-5 text-center">
            <div className="space-y-4">
              <h1 className="text-5xl font-semibold tracking-tight leading-tight">
                Upload invoices, get books ready
              </h1>
              <p className="text-base text-muted-foreground max-w-2xl mx-auto">
                Drop your PDF or image invoices and let Invox AI read, validate,
                and prep entries for Tally so your finance team can close faster.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              <Button asChild>
                <Link href="/dashboard">Head to Dashboard</Link>
              </Button>
            </div>
            <FileUploadPanel />
          </div>
        </div>
      </div>
    </main>
  );
}
