import { useState } from "react";
import { Outlet, useLocation } from "react-router";
import { FunZone } from "@/components/FunZone";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";
import type { GuestHeaderSlots } from "./guestHeader";

/** Phone-first shell for guests and public pages, with a quiet header. */
export function GuestLayout() {
  const [name, setName] = useState<HTMLElement | null>(null);
  const [bill, setBill] = useState<HTMLElement | null>(null);
  // The landing page shows the big wordmark itself.
  const showLogo = useLocation().pathname !== "/";
  return (
    <FunZone level="playful">
      <div data-layout="guest" className="mx-auto min-h-svh max-w-md p-4">
        <header className="flex items-center gap-1">
          {showLogo && <Logo className="text-2xl" />}
          <div ref={setName} className="ml-auto flex min-w-0" />
          <div ref={setBill} />
          <LanguageSwitcher />
        </header>
        <main className="space-y-4 pt-4">
          <Outlet context={{ name, bill } satisfies GuestHeaderSlots} />
        </main>
      </div>
    </FunZone>
  );
}
