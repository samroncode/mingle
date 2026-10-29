import { useState } from "react";
import { Outlet } from "react-router";
import { FunZone } from "@/components/FunZone";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

/** Phone-first shell for guests and public pages. */
export function GuestLayout() {
  // Where a guest's receipt icon goes, once there is a bill to show.
  const [billSlot, setBillSlot] = useState<HTMLElement | null>(null);
  return (
    <FunZone level="playful">
      <div data-layout="guest" className="mx-auto min-h-svh max-w-md p-4">
        <header className="flex items-center justify-end gap-1">
          <div ref={setBillSlot} />
          <LanguageSwitcher />
        </header>
        <main className="space-y-4 pt-4">
          <Outlet context={billSlot} />
        </main>
      </div>
    </FunZone>
  );
}
