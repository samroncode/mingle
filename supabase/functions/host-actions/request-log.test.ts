import { describe, expect, it } from "vitest";
import type { Db } from "./db.ts";
import { createHandler } from "./handler.ts";

const KEY = "k".repeat(43);
const SECRETS = [KEY, "Anna Andersson", "Swish 0701234567", "4242 kr"];

type FakeOptions = { user: boolean; rpcThrows?: boolean };

function fakeDb({ user, rpcThrows }: FakeOptions): Db {
  return {
    auth: {
      getUser: () =>
        Promise.resolve(
          user
            ? { data: { user: { id: "u1" } }, error: null }
            : { data: { user: null }, error: { message: "bad jwt" } },
        ),
    },
    rpc: () => {
      if (rpcThrows) throw new TypeError("boom Anna Andersson");
      return Promise.resolve({ data: null, error: { code: "XX000" } });
    },
  } as unknown as Db;
}

function run(opts: FakeOptions, init: { origin?: string; body: unknown }) {
  const lines: string[] = [];
  const handler = createHandler({
    db: fakeDb(opts),
    allowedOrigins: new Set(["https://app.test"]),
    logSink: (line) => lines.push(line),
  });
  const request = new Request("https://fn.test/host-actions", {
    method: "POST",
    headers: {
      Authorization: "Bearer jwt",
      ...(init.origin ? { Origin: init.origin } : {}),
    },
    body: JSON.stringify(init.body),
  });
  return handler(request).then((response) => ({ response, lines }));
}

const secretBody = {
  action: "set_payment",
  code: "ABC234",
  key: KEY,
  guestName: "Anna Andersson",
  swish: "Swish 0701234567",
  amount: "4242 kr",
};

function expectNoSecrets(lines: string[]) {
  for (const line of lines)
    for (const secret of SECRETS) expect(line).not.toContain(secret);
}

describe("one log line per request", () => {
  it("logs a refused origin", async () => {
    const { response, lines } = await run(
      { user: true },
      { origin: "https://evil.test", body: secretBody },
    );
    expect(response.status).toBe(403);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "")).toMatchObject({
      fn: "host-actions",
      action: null,
      result: "origin_not_allowed",
    });
    expectNoSecrets(lines);
  });

  it("logs a missing session with the event code but no secrets", async () => {
    const { lines } = await run({ user: false }, { body: secretBody });
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "")).toMatchObject({
      event: "ABC234",
      result: "not_authenticated",
    });
    expectNoSecrets(lines);
  });

  it("logs an invalid request without echoing the body", async () => {
    const { lines } = await run({ user: true }, { body: secretBody });
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "")).toMatchObject({
      result: "invalid_request",
    });
    expectNoSecrets(lines);
  });

  it("logs the action, result and milliseconds of a handled request", async () => {
    const { lines } = await run(
      { user: true },
      { body: { action: "claim_host", code: "ABC234", key: KEY } },
    );
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0] ?? "");
    expect(entry).toMatchObject({ action: "claim_host", event: "ABC234" });
    expect(typeof entry.ms).toBe("number");
    expectNoSecrets(lines);
  });

  it("logs only the name of a thrown error", async () => {
    const { response, lines } = await run(
      { user: true, rpcThrows: true },
      { body: { action: "claim_host", code: "ABC234", key: KEY } },
    );
    expect(response.status).toBe(500);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "")).toMatchObject({
      result: "internal_error",
      thrown: "TypeError",
    });
    expectNoSecrets(lines);
  });
});
