import { useEffect } from "react";
import { Outlet } from "react-router";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

// The TV is designed for 1920x1080, where 1rem is 16px. Everything is sized in
// rem, so scaling the root font to the viewport makes the whole layout fit
// smaller laptop screens (and larger TVs) without clipping.
const designWidth = 1920;
const designHeight = 1080;

function fitRootFontSize() {
  const scale = Math.min(
    window.innerWidth / designWidth,
    window.innerHeight / designHeight,
  );
  document.documentElement.style.fontSize = `${16 * scale}px`;
}

/** Scales the root font size to the viewport while the TV view is shown. */
function useFitToViewport() {
  useEffect(() => {
    fitRootFontSize();
    window.addEventListener("resize", fitRootFontSize);
    return () => {
      window.removeEventListener("resize", fitRootFontSize);
      document.documentElement.style.fontSize = "";
    };
  }, []);
}

/** Full-screen shell for the shared TV view, read from across the room. */
export function TvLayout() {
  useFitToViewport();
  return (
    <div
      data-layout="tv"
      className="relative min-h-svh p-(--space-6) font-body text-2xl"
    >
      <header className="absolute top-4 right-4">
        <LanguageSwitcher />
      </header>
      <main className="space-y-4">
        <Outlet />
      </main>
    </div>
  );
}
