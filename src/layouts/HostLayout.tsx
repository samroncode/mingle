import { Outlet } from "react-router";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

/** Shell for the host, who creates and runs the evening from a phone. */
export function HostLayout() {
  return (
    <div data-layout="host" className="mx-auto min-h-svh max-w-2xl p-4">
      <header className="flex justify-end">
        <LanguageSwitcher />
      </header>
      <main className="space-y-2 pt-4">
        <Outlet />
      </main>
    </div>
  );
}
