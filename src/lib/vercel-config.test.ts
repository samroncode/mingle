import vercelJson from "../../vercel.json?raw";
import { describe, expect, it } from "vitest";

interface Header {
  key: string;
  value: string;
}
interface VercelConfig {
  rewrites: { source: string; destination: string }[];
  headers: { source: string; headers: Header[] }[];
}

const config = JSON.parse(vercelJson) as VercelConfig;

const allPaths = config.headers.find((rule) => rule.source === "/(.*)");

function headerValue(key: string): string | undefined {
  return allPaths?.headers.find((header) => header.key === key)?.value;
}

function directives(): Map<string, string[]> {
  const policy = headerValue("Content-Security-Policy") ?? "";
  return new Map(
    policy
      .split(";")
      .map((part) => part.trim().split(/\s+/))
      .filter((parts) => parts[0] !== "")
      .map((parts): [string, string[]] => [parts[0] ?? "", parts.slice(1)]),
  );
}

describe("vercel.json", () => {
  it("keeps the SPA rewrite", () => {
    expect(config.rewrites).toContainEqual({
      source: "/(.*)",
      destination: "/index.html",
    });
  });

  it("sets the plain security headers on all paths", () => {
    expect(headerValue("Referrer-Policy")).toBe("no-referrer");
    expect(headerValue("X-Content-Type-Options")).toBe("nosniff");
    expect(headerValue("Permissions-Policy")).toBe(
      "camera=(), microphone=(), geolocation=()",
    );
  });

  it.each([
    ["default-src", ["'self'"]],
    ["script-src", ["'self'", "https://challenges.cloudflare.com"]],
    ["frame-src", ["https://challenges.cloudflare.com"]],
    ["connect-src", ["'self'", "https://*.supabase.co", "wss://*.supabase.co"]],
    ["img-src", ["'self'", "data:"]],
    ["style-src", ["'self'"]],
    ["font-src", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["object-src", ["'none'"]],
  ])("sets %s in the Content-Security-Policy", (name, sources) => {
    expect(directives().get(name)).toEqual(sources);
  });
});
