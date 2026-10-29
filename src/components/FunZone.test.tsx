import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import themeCss from "@/app/theme.css?raw";
import { defaultFunLevel } from "@/lib/fun";
import { FunZone } from "./FunZone";

describe("FunZone", () => {
  it("sets data-fun to its level", () => {
    const html = renderToStaticMarkup(<FunZone level="party">x</FunZone>);
    expect(html).toContain('data-fun="party"');
  });

  it("nests so the nearest zone is the innermost data-fun", () => {
    const html = renderToStaticMarkup(
      <FunZone level="calm">
        <FunZone level="party">
          <span id="inner" />
        </FunZone>
      </FunZone>,
    );
    expect(html.indexOf('data-fun="calm"')).toBeLessThan(
      html.indexOf('data-fun="party"'),
    );
    expect(html.indexOf('data-fun="party"')).toBeLessThan(
      html.indexOf('id="inner"'),
    );
  });

  it("defaults to playful where no zone is set", () => {
    expect(defaultFunLevel).toBe("playful");
    expect(themeCss).toMatch(/:root,\s*\[data-fun="playful"\]\s*\{/);
  });

  it("turns every level calm under prefers-reduced-motion", () => {
    expect(themeCss).toMatch(
      /prefers-reduced-motion: reduce\)\s*\{\s*:root,\s*\[data-fun\]/,
    );
  });
});
