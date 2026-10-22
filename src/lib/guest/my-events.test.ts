import { afterEach, describe, expect, it, vi } from "vitest";
import type { NicheId } from "@/niches/ids";
import { addMyEvent, forgetMyEvent, loadMyEvents } from "./my-events";

const day = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 5, 1);
const key = "a".repeat(43);

function stubStorage(initial?: string) {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set("mingle.myEvents", initial);
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v),
  });
  return values;
}

function entry(code: string, createdAt: number, niche: NicheId = "aw") {
  return { code, key, niche, createdAt };
}

afterEach(() => vi.unstubAllGlobals());

describe("my events", () => {
  it("adds an event and lists it", () => {
    stubStorage();
    addMyEvent({ code: "ABC234", key, niche: "team", createdAt: now }, now);
    expect(loadMyEvents(now)).toEqual([entry("ABC234", now, "team")]);
  });

  it("lists newest first", () => {
    stubStorage();
    addMyEvent(entry("AAAAAA", now - 2 * day), now);
    addMyEvent(entry("BBBBBB", now - day), now);
    expect(loadMyEvents(now).map((e) => e.code)).toEqual(["BBBBBB", "AAAAAA"]);
  });

  it("replaces an entry with the same code", () => {
    stubStorage();
    addMyEvent(entry("ABC234", now - day), now);
    addMyEvent(entry("ABC234", now), now);
    expect(loadMyEvents(now)).toEqual([entry("ABC234", now)]);
  });

  it("forgets one event and keeps the rest", () => {
    stubStorage();
    addMyEvent(entry("AAAAAA", now - day), now);
    addMyEvent(entry("BBBBBB", now), now);
    forgetMyEvent("AAAAAA", now);
    expect(loadMyEvents(now).map((e) => e.code)).toEqual(["BBBBBB"]);
  });

  it("drops entries older than 30 days", () => {
    stubStorage(
      JSON.stringify([
        entry("AAAAAA", now - 31 * day),
        entry("BBBBBB", now - 29 * day),
      ]),
    );
    expect(loadMyEvents(now).map((e) => e.code)).toEqual(["BBBBBB"]);
  });

  it("ignores a value that is not JSON or not a list", () => {
    stubStorage("{broken");
    expect(loadMyEvents(now)).toEqual([]);
    stubStorage('{"a":1}');
    expect(loadMyEvents(now)).toEqual([]);
  });

  it("drops invalid entries one by one", () => {
    stubStorage(
      JSON.stringify([
        entry("lower1", now),
        { ...entry("CCCCCC", now), key: "short" },
        { ...entry("DDDDDD", now), niche: "party" },
        { code: "EEEEEE" },
        entry("FFFFFF", now),
      ]),
    );
    expect(loadMyEvents(now).map((e) => e.code)).toEqual(["FFFFFF"]);
  });

  it("works without storage", () => {
    const blocked = () => {
      throw new Error("blocked");
    };
    vi.stubGlobal("localStorage", { getItem: blocked, setItem: blocked });
    expect(() => addMyEvent(entry("ABC234", now), now)).not.toThrow();
    expect(() => forgetMyEvent("ABC234", now)).not.toThrow();
    expect(loadMyEvents(now)).toEqual([]);
  });
});
