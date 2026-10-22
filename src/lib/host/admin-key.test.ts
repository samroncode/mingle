import { describe, expect, it } from "vitest";
import { readAdminKey } from "./admin-key";

// 32 random bytes, base64url-encoded: 43 characters, no padding.
const KEY = "dGhpcy1pcy1hLTMyLWJ5dGUta2V5LWZvci10ZXN0cyE";

describe("readAdminKey", () => {
  it("returns the key with or without the leading #", () => {
    expect(readAdminKey(`#key=${KEY}`)).toBe(KEY);
    expect(readAdminKey(`key=${KEY}`)).toBe(KEY);
  });

  it("returns nothing for an empty fragment, a missing key or an empty value", () => {
    expect(readAdminKey("")).toBeUndefined();
    expect(readAdminKey("#")).toBeUndefined();
    expect(readAdminKey("#other=1")).toBeUndefined();
    expect(readAdminKey("#key=")).toBeUndefined();
  });

  it("returns nothing for a value that is not base64url of the expected length", () => {
    expect(readAdminKey("#key=short")).toBeUndefined();
    expect(readAdminKey(`#key=${KEY}x`)).toBeUndefined();
    expect(readAdminKey(`#key=${KEY.slice(0, 42)}+`)).toBeUndefined();
    expect(readAdminKey(`#key=${KEY.slice(0, 42)}=`)).toBeUndefined();
  });

  it("handles other parameters next to key", () => {
    expect(readAdminKey(`#a=1&key=${KEY}&b=2`)).toBe(KEY);
  });

  it("handles URL-encoded values", () => {
    const encoded = [...KEY]
      .map((c) => "%" + c.charCodeAt(0).toString(16))
      .join("");
    expect(readAdminKey(`#key=${encoded}`)).toBe(KEY);
  });
});
