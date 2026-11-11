import { Outlet, useMatch } from "react-router";
import { FunZone } from "@/components/FunZone";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

/** Shell for the host, who creates and runs the evening from a phone. */
export function HostLayout() {
  // The control panel has the language switcher in its own top bar.
  const inPanel = useMatch("/host/:code") !== null;
  return (
    <FunZone level="calm">
      <div
        data-layout="host"
        className="mx-auto min-h-svh max-w-2xl p-4 lg:max-w-[100rem]"
      >
        {!inPanel && (
          <header className="flex justify-end">
            <LanguageSwitcher />
          </header>
        )}
        <main className={inPanel ? "space-y-2" : "space-y-2 pt-4"}>
          <Outlet />
        </main>
      </div>
    </FunZone>
  );
}
