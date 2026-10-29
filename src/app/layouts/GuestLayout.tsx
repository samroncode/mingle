import { Outlet } from "react-router";
import { FunZone } from "@/components/FunZone";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

/** Phone-first shell for guests and public pages. */
export function GuestLayout() {
  return (
    <FunZone level="playful">
      <div data-layout="guest" className="mx-auto min-h-svh max-w-md p-4">
        <header className="flex justify-end">
          <LanguageSwitcher />
        </header>
        <main className="space-y-4 pt-4">
          <Outlet />
        </main>
      </div>
    </FunZone>
  );
}
