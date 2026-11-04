import { describe, expect, it } from "vitest";
import { swishAppLink, swishMessage, swishPayee, swishQrText } from "./swish";

describe("swishPayee", () => {
  it("gives the 46 form from any way of writing the number", () => {
    expect(swishPayee("070-123 45 67")).toBe("46701234567");
    expect(swishPayee("+46701234567")).toBe("46701234567");
    expect(swishPayee("46701234567")).toBe("46701234567");
    expect(swishPayee("1231234567")).toBe("1231234567");
  });
});

describe("swishMessage", () => {
  it("joins the code and the guest's name", () => {
    expect(swishMessage("K7Q2", "Anna")).toBe("Mingle K7Q2 Anna");
  });
  it("keeps Swedish letters and drops what Swish refuses", () => {
    expect(swishMessage("K7Q2", "Åsa Öberg")).toBe("Mingle K7Q2 Åsa Öberg");
    expect(swishMessage("K7Q2", "Zoë 🎉 Ng")).toBe("Mingle K7Q2 Zoe Ng");
    expect(swishMessage("K7Q2", "Ann–Marie")).toBe("Mingle K7Q2 Ann-Marie");
  });
  it("cuts to 50 characters", () => {
    const message = swishMessage("K7Q2", "A".repeat(80));
    expect([...message]).toHaveLength(50);
    expect(message.startsWith("Mingle K7Q2 AAA")).toBe(true);
  });
});

describe("swishAppLink", () => {
  it("matches the link Swish's own generator makes", () => {
    expect(
      swishAppLink({ number: "46730222222", amount: 12, message: "ssss" }),
    ).toBe(
      "https://app.swish.nu/1/p/sw/?sw=0730222222&amt=12&cur=SEK&msg=ssss&src=qr",
    );
  });
  it("encodes the message and accepts any way of writing the number", () => {
    expect(
      swishAppLink({
        number: "070-123 45 67",
        amount: 120,
        message: "Mingle K7Q2 Åsa & co",
      }),
    ).toBe(
      "https://app.swish.nu/1/p/sw/?sw=0701234567&amt=120&cur=SEK&msg=Mingle%20K7Q2%20%C3%85sa%20%26%20co&src=qr",
    );
  });
});

describe("swishQrText", () => {
  it("writes number, amount with a decimal comma, encoded message and mask", () => {
    expect(
      swishQrText({
        number: "+46701234567",
        amount: 120,
        message: "Mingle K7Q2 Åsa",
      }),
    ).toBe("C46701234567;120,00;Mingle%20K7Q2%20%C3%85sa;2");
  });
});
