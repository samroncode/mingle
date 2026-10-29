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
  const link = swishAppLink({
    number: "070-123 45 67",
    amount: 120,
    message: "Mingle K7Q2 Anna & co",
  });
  it("opens the Swish app with encoded JSON", () => {
    expect(link.startsWith("swish://payment?data=")).toBe(true);
    expect(link).not.toContain("&");
    expect(link).not.toContain(" ");
  });
  it("carries the number, a numeric amount the payer can edit, and the message", () => {
    const data: unknown = JSON.parse(
      decodeURIComponent(link.slice("swish://payment?data=".length)),
    );
    expect(data).toEqual({
      version: 1,
      payee: { value: "46701234567" },
      amount: { value: 120, editable: true },
      message: { value: "Mingle K7Q2 Anna & co" },
    });
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
