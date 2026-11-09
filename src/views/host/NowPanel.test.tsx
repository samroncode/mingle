import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { EventRow } from "@/api/events";
import { NowPanel } from "./NowPanel";

vi.mock("@/modules/definitions", () => ({
  moduleDefinitions: {
    quiz: { Live: () => <p>quiz controls</p> },
    awards: {},
  },
}));

function event(over: Partial<EventRow>): EventRow {
  return {
    code: "ABCD",
    status: "live",
    current_module: null,
    ...over,
  } as EventRow;
}

function html(over: Partial<EventRow>) {
  return renderToStaticMarkup(
    <NowPanel event={event(over)} members={[]} hostKey="k" />,
  );
}

describe("NowPanel", () => {
  it("shows the running activity's Live part", () => {
    const out = html({ current_module: "quiz" });
    expect(out).toContain("quiz controls");
    expect(out).not.toContain("now-empty");
  });

  it("shows the calm line when nothing runs", () => {
    expect(html({})).toContain("now-empty");
  });

  it("shows the calm line for an activity without a Live part", () => {
    expect(html({ current_module: "awards" })).toContain("now-empty");
  });

  it("is hidden after the evening ended", () => {
    expect(html({ status: "ended" })).toBe("");
  });
});
