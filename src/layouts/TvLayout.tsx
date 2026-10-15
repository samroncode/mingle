import { Outlet } from "react-router";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

/** Full-screen shell for the shared TV view, read from across the room. */
export function TvLayout() {
  return (
    <div data-layout="tv" className="relative min-h-svh p-12 text-2xl">
      <header className="absolute top-4 right-4">
        <LanguageSwitcher />
      </header>
      <main className="space-y-4">
        <Outlet />
      </main>
    </div>
  );
}
