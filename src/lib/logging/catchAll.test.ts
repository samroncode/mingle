import { describe, expect, it, vi } from "vitest";
import {
  createLimiter,
  entryFromCsp,
  entryFromThrown,
  installCatchAll,
  reportRenderCrash,
  type CaughtEntry,
} from "./catchAll";
import { stripUrlSecrets } from "./sanitize";

const target = new EventTarget();
const asWindow = target as unknown as Window;

function fire(type: string, props: Record<string, unknown>) {
  const event = new Event(type);
  Object.assign(event, props);
  target.dispatchEvent(event);
}

describe("stripUrlSecrets", () => {
  it("drops the host key from a URL in a message", () => {
    const out = stripUrlSecrets(
      "Failed at https://x.app/host/ABC#key=secret ok",
    );
    expect(out).toBe("Failed at https://x.app/host/ABC ok");
  });
  it("drops a bare fragment and key value", () => {
    expect(stripUrlSecrets("bad #key=secret and key=hush")).not.toMatch(
      /secret|hush/,
    );
  });
});

describe("entryFromThrown", () => {
  it("logs a URL with #key=secret without the key, in message and stack", () => {
    const err = new Error("boom at https://x.app/host/ABC#key=secret");
    err.stack =
      "Error: boom\n at f (https://x.app/host/ABC?a=1#key=secret:1:2)";
    const entry = entryFromThrown("error", "uncaught", err);
    expect(JSON.stringify(entry)).not.toMatch(/secret|a=1/);
    expect(entry.message).toContain("https://x.app/host/ABC");
  });
  it("truncates long text", () => {
    const err = new Error("x".repeat(5000));
    err.stack = "y".repeat(5000);
    const entry = entryFromThrown("render", "error_view", err);
    expect(entry.message?.length).toBe(300);
    expect(entry.stack?.length).toBe(1000);
  });
  it("handles values that are not errors", () => {
    expect(entryFromThrown("rejection", "x", { secret: 1 }).message).toBe(
      "non_error_value",
    );
  });
});

describe("entryFromCsp", () => {
  it("keeps the directive and host only", () => {
    const entry = entryFromCsp({
      effectiveDirective: "connect-src",
      blockedURI: "https://evil.example/path?q=1#key=secret",
    } as SecurityPolicyViolationEvent);
    expect(entry).toMatchObject({
      area: "csp",
      action: "csp_violation",
      code: "connect-src",
      message: "evil.example",
    });
    expect(JSON.stringify(entry)).not.toMatch(/secret|path/);
  });
});

describe("createLimiter", () => {
  it("allows a few repeats and caps the page", () => {
    const allow = createLimiter();
    const same: CaughtEntry = {
      kind: "error",
      area: "app",
      action: "a",
      code: "E",
      message: "m",
    };
    const results = Array.from({ length: 10 }, () => allow(same));
    expect(results.filter(Boolean)).toHaveLength(3);
    let accepted = 0;
    for (let i = 0; i < 100; i++) {
      if (allow({ ...same, message: `m${i}` })) accepted++;
    }
    expect(accepted).toBeLessThanOrEqual(17);
  });
});

describe("installCatchAll", () => {
  it("logs an uncaught error and a rejection once each", () => {
    const sink = vi.fn();
    const stop = installCatchAll(sink, asWindow);
    fire("error", { error: new TypeError("bad"), message: "bad" });
    fire("unhandledrejection", { reason: new Error("nope") });
    expect(sink).toHaveBeenCalledTimes(2);
    expect(sink.mock.calls[0]?.[0]).toMatchObject({ kind: "error" });
    expect(sink.mock.calls[1]?.[0]).toMatchObject({ kind: "rejection" });
    stop();
  });
  it("logs a repeated error only a few times", () => {
    const sink = vi.fn();
    const stop = installCatchAll(sink, asWindow);
    for (let i = 0; i < 50; i++) fire("error", { error: new Error("loop") });
    expect(sink).toHaveBeenCalledTimes(3);
    stop();
  });
  it("logs a CSP violation", () => {
    const sink = vi.fn();
    const stop = installCatchAll(sink, asWindow);
    fire("securitypolicyviolation", {
      effectiveDirective: "script-src",
      blockedURI: "https://a.example/x.js",
    });
    expect(sink.mock.calls[0]?.[0]).toMatchObject({ code: "script-src" });
    stop();
  });
  it("never throws when the sink does", () => {
    const stop = installCatchAll(() => {
      throw new Error("sink down");
    }, asWindow);
    expect(() => fire("error", { error: new Error("x") })).not.toThrow();
    stop();
  });
});

describe("reportRenderCrash", () => {
  it("sends one render entry", () => {
    const sink = vi.fn();
    reportRenderCrash(new Error("crash"), sink);
    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink.mock.calls[0]?.[0]).toMatchObject({
      kind: "render",
      action: "error_view",
    });
  });
  it("never throws when the sink does", () => {
    expect(() =>
      reportRenderCrash(new Error("x"), () => {
        throw new Error("down");
      }),
    ).not.toThrow();
  });
});
