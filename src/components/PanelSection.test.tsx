import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PanelSection } from "./PanelSection";

describe("PanelSection", () => {
  it("shows the title and summary but not the content while shut", () => {
    const html = renderToStaticMarkup(
      <PanelSection title="Quiz" summary="8 questions">
        <p>secret list</p>
      </PanelSection>,
    );
    expect(html).toContain("Quiz");
    expect(html).toContain("8 questions");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("secret list");
  });

  it("renders the content when it starts open", () => {
    const html = renderToStaticMarkup(
      <PanelSection title="Quiz" defaultOpen>
        <p>secret list</p>
      </PanelSection>,
    );
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("secret list");
  });
});
