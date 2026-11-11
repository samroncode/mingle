import { describe, expect, it, vi } from "vitest";
import type { WizardDraft } from "@/lib/wizard/state";
import { attemptCreate } from "./useCreateEvent";

vi.mock("@/lib/wizard/state", () => ({ toCreateInput: () => ({}) }));

const draft = {} as WizardDraft;
const signedIn = () => Promise.resolve({ ok: true as const, value: "u1" });

describe("attemptCreate", () => {
  it("maps a failed CAPTCHA", async () => {
    const result = await attemptCreate(draft, {
      ensureSession: () =>
        Promise.resolve({
          ok: false as const,
          error: "captcha_failed" as const,
        }),
      create: vi.fn(),
    });
    expect(result).toEqual({ ok: false, error: "captcha_failed" });
  });
  it("turns a throwing sign-in into a network error", async () => {
    const result = await attemptCreate(draft, {
      ensureSession: () => Promise.reject(new Error("x")),
      create: vi.fn(),
    });
    expect(result).toEqual({ ok: false, error: "network_error" });
  });
  it("turns a throwing create into a network error", async () => {
    const result = await attemptCreate(draft, {
      ensureSession: signedIn,
      create: () => Promise.reject(new Error("x")),
    });
    expect(result).toEqual({ ok: false, error: "network_error" });
  });
  it("passes a host action error on", async () => {
    const result = await attemptCreate(draft, {
      ensureSession: signedIn,
      create: () =>
        Promise.resolve({ ok: false as const, error: "rate_limited" as const }),
    });
    expect(result).toEqual({ ok: false, error: "rate_limited" });
  });
});
