import { Outlet } from "react-router";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

/** Full-screen shell for the shared TV view, read from across the room. */
export function TvLayout() {
  return (
    <div
      data-layout="tv"
      className="relative min-h-svh p-(--space-6) font-body text-2xl"
    >
      {/* Inside the party screen's frame, so it sits on the surface, not the mat. */}
      <header className="absolute top-[calc(var(--space-7)+var(--space-6))] right-[calc(var(--space-7)+var(--space-7))] z-10">
        <LanguageSwitcher />
      </header>
      <main className="space-y-4">
        <Outlet />
      </main>
    </div>
  );
}
