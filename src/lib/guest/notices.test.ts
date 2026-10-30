import { afterEach, describe, expect, it, vi } from "vitest";
import type { NoticeView } from "@/api/notices";
import { pickBanner, readDismissed, writeDismissed } from "./notices";

const notice = (id: string, createdAt: string, text = id): NoticeView => ({
  id,
  text,
  createdAt,
});
const joined = "2026-10-30T20:00:00Z";
const early = notice("early", "2026-10-30T19:00:00Z");
const first = notice("first", "2026-10-30T20:10:00Z");
const second = notice("second", "2026-10-30T20:20:00Z");
const newestFirst = [second, first, early];

describe("pickBanner", () => {
  it("shows the newest notice sent after joining, with how many more wait", () => {
    expect(pickBanner(newestFirst, new Set(), joined)).toEqual({
      notice: second,
      more: 1,
    });
  });

  it("skips dismissed notices and shows the next one", () => {
    expect(pickBanner(newestFirst, new Set(["second"]), joined)).toEqual({
      notice: first,
      more: 0,
    });
  });

  it("shows nothing when everything is dismissed or older than the join", () => {
    expect(pickBanner(newestFirst, new Set(["second", "first"]), joined)).toBe(
      null,
    );
    expect(pickBanner([early], new Set(), joined)).toBeNull();
  });

  it("shows a later message again after an earlier one was dismissed", () => {
    expect(
      pickBanner([second, first], new Set(["first"]), joined)?.notice,
    ).toBe(second);
  });

  it("shows nothing when the join time is unknown", () => {
    expect(pickBanner(newestFirst, new Set(), undefined)).toBeNull();
  });

  it("keeps text as it is, so the view can render it as plain text", () => {
    const rude = notice("x", "2026-10-30T21:00:00Z", "<b>Hi</b> https://a.b");
    expect(pickBanner([rude], new Set(), joined)?.notice.text).toBe(
      "<b>Hi</b> https://a.b",
    );
  });
});

describe("dismissed ids in storage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("remembers ids per event", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    });
    writeDismissed("e1", new Set(["a", "b"]));
    expect([...readDismissed("e1")]).toEqual(["a", "b"]);
    expect(readDismissed("e2").size).toBe(0);
  });

  it("ignores broken stored data", () => {
    vi.stubGlobal("localStorage", { getItem: () => "{nope" });
    expect(readDismissed("e1").size).toBe(0);
    vi.stubGlobal("localStorage", { getItem: () => '{"a":1}' });
    expect(readDismissed("e1").size).toBe(0);
  });

  it("works when localStorage throws", () => {
    const boom = () => {
      throw new Error("denied");
    };
    vi.stubGlobal("localStorage", { getItem: boom, setItem: boom });
    expect(readDismissed("e1").size).toBe(0);
    expect(() => writeDismissed("e1", new Set(["a"]))).not.toThrow();
  });
});
