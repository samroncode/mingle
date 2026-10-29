/** The longest message the Swish app shows and stores. */
const MESSAGE_MAX = 50;

/**
 * The message to prefill in Swish: "Mingle K7Q2 Anna". Swish only accepts
 * letters, digits and a few marks, so accents are dropped where a plain
 * letter remains, dashes become hyphens and anything else becomes a space.
 * Cut to 50 characters.
 */
export function swishMessage(code: string, guestName: string): string {
  const cleaned = [
    ...`Mingle ${code} ${guestName}`.replace(/[\u2010-\u2015]/g, "-"),
  ]
    .map(toAllowed)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return [...cleaned].slice(0, MESSAGE_MAX).join("").trim();
}

const ALLOWED = /^[A-Za-z0-9åäöÅÄÖéÉüÜ.,:;?!()'"\s-]$/;

/** The character itself, its accent-free form, or a space. */
function toAllowed(char: string): string {
  if (ALLOWED.test(char)) return char;
  const plain = char.normalize("NFD").replace(/\p{M}/gu, "");
  return ALLOWED.test(plain) ? plain : " ";
}

/** A number as Swish wants it: digits only, country code 46 for mobiles. */
export function swishPayee(stored: string): string {
  const digits = stored.replace(/\D/g, "");
  if (digits.startsWith("46")) return digits;
  return digits.startsWith("0") ? `46${digits.slice(1)}` : digits;
}

/**
 * The link that opens the Swish app with the payment filled in. The amount
 * stays editable in Swish, so a guest can pay a different sum.
 */
export function swishAppLink(args: {
  number: string;
  amount: number;
  message: string;
}): string {
  const data = {
    version: 1,
    payee: { value: swishPayee(args.number) },
    amount: { value: args.amount, editable: true },
    message: { value: args.message },
  };
  return `swish://payment?data=${encodeURIComponent(JSON.stringify(data))}`;
}

/**
 * The text of a Swish QR code: `C<payee>;<amount>;<message>;<mask>`. The
 * mask is a bit sum of the fields the payer may edit (payee 1, amount 2,
 * message 4); we open only the amount, so 2.
 */
export function swishQrText(args: {
  number: string;
  amount: number;
  message: string;
}): string {
  const payee = swishPayee(args.number);
  return `C${payee};${args.amount.toFixed(2).replace(".", ",")};${encodeURIComponent(args.message)};2`;
}
