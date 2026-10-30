import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NicheTheme } from "./NicheTheme";

describe("NicheTheme", () => {
  it("uses the niche's own theme", () => {
    const html = renderToStaticMarkup(<NicheTheme niche="team">x</NicheTheme>);
    expect(html).toContain('data-theme="loud"');
  });

  it("uses the day theme in a bright room", () => {
    const html = renderToStaticMarkup(
      <NicheTheme niche="team" bright>
        x
      </NicheTheme>,
    );
    expect(html).toContain('data-theme="day"');
    expect(html).not.toContain('data-theme="loud"');
  });

  it("goes back to the niche's theme when bright is off", () => {
    const html = renderToStaticMarkup(
      <NicheTheme niche="aw" bright={false}>
        x
      </NicheTheme>,
    );
    expect(html).toContain('data-theme="garden"');
  });
});
