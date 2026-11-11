import { useLocation, useNavigate, type To } from "react-router";
import {
  panelSearch,
  readPanelLocation,
  type PanelLocation,
  type PanelView,
  type PrepareSection,
} from "@/lib/host/panel-view";

/**
 * The control panel's view and Prepare section from the URL query, and links
 * to others. Links carry the fragment along, because it holds the admin key.
 */
export function usePanelLocation(): PanelLocation & {
  to: (view: PanelView, section?: PrepareSection) => To;
  go: (view: PanelView, section?: PrepareSection) => void;
} {
  const { search, hash } = useLocation();
  const navigate = useNavigate();
  const to = (view: PanelView, section?: PrepareSection): To => ({
    search: panelSearch(search, view, section),
    hash,
  });
  return {
    ...readPanelLocation(search),
    to,
    go: (view, section) => void navigate(to(view, section), { replace: true }),
  };
}
