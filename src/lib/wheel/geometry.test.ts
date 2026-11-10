import { describe, expect, it } from "vitest";
import {
  finalRotation,
  labelLimit,
  minimumTurns,
  randomOffset,
  truncateLabel,
  wedgePath,
  wedges,
  wedgeUnderPointer,
} from "./geometry";

describe("wedges", () => {
  it("gives one entry the whole circle", () => {
    expect(wedges(1)).toEqual([{ index: 0, start: 0, end: 360, middle: 180 }]);
  });

  it("splits two entries in halves", () => {
    expect(wedges(2).map((w) => [w.start, w.end])).toEqual([
      [0, 180],
      [180, 360],
    ]);
  });

  it("fills the circle with 24 equal wedges", () => {
    const all = wedges(24);
    expect(all).toHaveLength(24);
    expect(all[0]?.start).toBe(0);
    expect(all[23]?.end).toBeCloseTo(360);
    expect(all[5]?.end).toBeCloseTo(all[6]?.start ?? NaN);
  });
});

describe("finalRotation", () => {
  const cases: Array<[number, number]> = [
    [1, 0],
    [2, 0],
    [2, 1],
    [24, 0],
    [24, 23],
    [24, 11],
    [7, 3],
  ];

  it.each(cases)(
    "lands inside the winner's wedge (%i entries, winner %i)",
    (count, winnerIndex) => {
      for (const offset of [0.15, 0.5, 0.85]) {
        const rotation = finalRotation({ count, winnerIndex, offset });
        expect(wedgeUnderPointer(count, rotation)).toBe(winnerIndex);
      }
    },
  );

  it("keeps away from the wedge edges for random offsets", () => {
    for (let i = 0; i < 50; i++) {
      const offset = randomOffset();
      expect(offset).toBeGreaterThanOrEqual(0.15);
      expect(offset).toBeLessThanOrEqual(0.85);
    }
    expect(randomOffset(() => 0)).toBe(0.15);
    expect(randomOffset(() => 1)).toBeCloseTo(0.85);
  });

  it("always turns forward at least the minimum turns", () => {
    const rotation = finalRotation({ count: 5, winnerIndex: 2 });
    expect(rotation).toBeGreaterThanOrEqual(minimumTurns * 360);
  });

  it("keeps rotating forward over repeated spins and still lands", () => {
    let rotation = 0;
    for (const winnerIndex of [3, 3, 0, 5, 1]) {
      const next = finalRotation({
        count: 6,
        winnerIndex,
        currentRotation: rotation,
        offset: 0.4,
      });
      expect(next).toBeGreaterThanOrEqual(rotation + minimumTurns * 360);
      expect(next).toBeLessThan(rotation + (minimumTurns + 1) * 360);
      expect(wedgeUnderPointer(6, next)).toBe(winnerIndex);
      rotation = next;
    }
  });

  it("refuses a winner that is not on the wheel", () => {
    expect(() => finalRotation({ count: 3, winnerIndex: 3 })).toThrow(
      RangeError,
    );
    expect(() => finalRotation({ count: 3, winnerIndex: -1 })).toThrow(
      RangeError,
    );
  });
});

describe("truncateLabel", () => {
  it("leaves a short label alone", () => {
    expect(truncateLabel(" Anna ", 14)).toBe("Anna");
  });

  it("cuts a long label to the limit with an ellipsis", () => {
    const cut = truncateLabel("Take a shot of something", 11);
    expect(Array.from(cut)).toHaveLength(11);
    expect(cut.endsWith("…")).toBe(true);
  });

  it("does not split an emoji", () => {
    expect(truncateLabel("🍕🍕🍕🍕", 3)).toBe("🍕🍕…");
  });

  it("allows shorter labels on a fuller wheel", () => {
    expect(labelLimit(4)).toBeGreaterThan(labelLimit(12));
    expect(labelLimit(12)).toBeGreaterThan(labelLimit(24));
  });
});

describe("wedgePath", () => {
  it("draws a quarter as a small arc ending on the right", () => {
    expect(wedgePath(100, 0, 90)).toBe("M0 0L0 -100A100 100 0 0 1 100 0Z");
  });

  it("uses the large arc flag over half a circle", () => {
    expect(wedgePath(100, 0, 270)).toContain("0 1 1");
  });
});
