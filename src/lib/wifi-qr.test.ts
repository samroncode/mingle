import { describe, expect, it } from "vitest";
import { wifiQrText } from "./wifi-qr";

describe("wifiQrText", () => {
  it("encodes a network with a password as WPA", () => {
    expect(wifiQrText({ ssid: "Home", password: "secret" })).toBe(
      "WIFI:T:WPA;S:Home;P:secret;;",
    );
  });

  it("encodes an empty password as an open network", () => {
    expect(wifiQrText({ ssid: "Cafe", password: "" })).toBe(
      "WIFI:T:nopass;S:Cafe;;",
    );
  });

  it("escapes backslash, semicolon, comma, colon and quote", () => {
    expect(wifiQrText({ ssid: 'a\\b;c,d:e"f', password: "p;w" })).toBe(
      'WIFI:T:WPA;S:a\\\\b\\;c\\,d\\:e\\"f;P:p\\;w;;',
    );
  });
});
