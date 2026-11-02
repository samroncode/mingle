import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-router", () => ({ useRouteError: () => new Error("crash") }));
vi.mock("@/api/log", () => ({ logCaught: vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { ErrorView } from "./ErrorView";

describe("ErrorView", () => {
  it("shows its message and a reload button", () => {
    const html = renderToStaticMarkup(<ErrorView />);
    expect(html).toContain("views.error.title");
    expect(html).toContain("views.error.reload");
  });
});
