import { describe, expect, it } from "vitest";
import type { Result } from "@/api/errors";
import { nextRun, type ModuleRun } from "./useModuleRun";

// There is no React testing library in the project, so the hook's logic is
// tested as the pure piece it is built from (the stale protection comes from
// `startLoad`, tested in useLoad.test.ts).
const good = <T>(value: T): Result<T, string> => ({ ok: true, value });
const bad: Result<never, string> = { ok: false, error: "unknown" };
const start: ModuleRun<string, number> = {
  progress: null,
  items: [],
  failed: false,
  version: 0,
};

describe("nextRun", () => {
  it("takes the new data and counts the read", () => {
    expect(nextRun(start, good("p"), good([1, 2]))).toEqual({
      progress: "p",
      items: [1, 2],
      failed: false,
      version: 1,
    });
  });

  it("keeps the last data when the progress read fails", () => {
    const last = nextRun(start, good("p"), good([1]));
    expect(nextRun(last, bad, good([2]))).toEqual({
      progress: "p",
      items: [1],
      failed: true,
      version: 2,
    });
  });

  it("keeps the last data when the items read fails", () => {
    const last = nextRun(start, good("p"), good([1]));
    expect(nextRun(last, good("q"), bad)).toMatchObject({
      progress: "p",
      items: [1],
      failed: true,
    });
  });

  it("clears the failure on the next good read", () => {
    const failed = nextRun(start, bad, bad);
    expect(nextRun(failed, good("p"), good([3]))).toMatchObject({
      items: [3],
      failed: false,
      version: 2,
    });
  });
});
