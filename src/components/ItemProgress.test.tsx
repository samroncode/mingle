import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ItemProgress } from "./ItemProgress";

describe("ItemProgress", () => {
  it("shows the activity and position and exposes the progress", () => {
    const html = renderToStaticMarkup(
      <ItemProgress
        activity="Quiz"
        position="Question 2 of 3"
        number={2}
        total={3}
      />,
    );
    expect(html).toContain("Quiz · Question 2 of 3");
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="2"');
    expect(html).toContain('aria-valuemax="3"');
    expect(html.match(/data-segment=/g)).toHaveLength(3);
  });

  it("marks segments done, current and upcoming", () => {
    const html = renderToStaticMarkup(
      <ItemProgress activity="Quiz" position="x" number={2} total={3} />,
    );
    expect(
      [...html.matchAll(/data-segment="(\w+)"/g)].map((m) => m[1]),
    ).toEqual(["done", "current", "upcoming"]);
  });
});
