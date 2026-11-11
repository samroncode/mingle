import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { usePanelLocation } from "@/hooks/usePanelLocation";
import { panelViews, type PanelView } from "@/lib/host/panel-view";
import { cn } from "cn";

interface ViewSwitchProps {
  /** "bar" sits in the top bar; "tabs" is the phone's bottom tab bar. */
  variant: "bar" | "tabs";
}

/**
 * Run / Prepare as a labelled group of links; the current one is marked with
 * `aria-current`. The view lives in the URL query, so a reload keeps it.
 */
export function ViewSwitch({ variant }: ViewSwitchProps) {
  const { t } = useTranslation();
  const location = usePanelLocation();
  const tabs = variant === "tabs";
  return (
    <nav
      aria-label={t("hostPanel.view.label")}
      data-testid={tabs ? "view-tabs" : "view-switch"}
      className={cn(
        tabs
          ? "fixed inset-x-0 bottom-0 z-30 border-t-[length:var(--border-chunky)] border-edge bg-surface pb-[env(safe-area-inset-bottom)]"
          : "rounded-pill bg-surface-sunken p-1",
      )}
    >
      <ul className="flex">
        {panelViews.map((view: PanelView) => {
          const current = location.view === view;
          return (
            <li key={view} className="flex-1">
              <Link
                to={location.to(view)}
                replace
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex items-center justify-center whitespace-nowrap font-display font-bold",
                  tabs
                    ? "min-h-14 text-lg"
                    : "min-h-10 rounded-pill px-5 text-base",
                  current
                    ? tabs
                      ? "text-ink underline decoration-coral decoration-4 underline-offset-8"
                      : "bg-paper text-on-paper"
                    : "text-ink-muted hover:text-ink",
                )}
              >
                {t(`hostPanel.view.${view}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
